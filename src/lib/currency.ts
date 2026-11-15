import { CurrencyExchangeRate } from '../types';
import { tenantStorage } from '../db/dexieDB';

export interface CurrencyMetadata {
  code: string;
  symbol: string;
  nameAr: string;
  nameEn: string;
  flag: string;
  defaultRateAgainstEGP: number;
  defaultRateToBase?: number;
}

export const SUPPORTED_CURRENCIES: CurrencyMetadata[] = [
  { code: 'EGP', symbol: 'ج.م', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', flag: '🇪🇬', defaultRateAgainstEGP: 1.0, defaultRateToBase: 1.0 },
  { code: 'USD', symbol: '$', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', flag: '🇺🇸', defaultRateAgainstEGP: 50.5, defaultRateToBase: 50.5 },
  { code: 'EUR', symbol: '€', nameAr: 'يورو أوروبي', nameEn: 'Euro', flag: '🇪🇺', defaultRateAgainstEGP: 54.2, defaultRateToBase: 54.2 },
  { code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', flag: '🇸🇦', defaultRateAgainstEGP: 13.45, defaultRateToBase: 13.45 },
  { code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', flag: '🇦🇪', defaultRateAgainstEGP: 13.75, defaultRateToBase: 13.75 },
  { code: 'KWD', symbol: 'د.ك', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', flag: '🇰🇼', defaultRateAgainstEGP: 164.2, defaultRateToBase: 164.2 },
  { code: 'QAR', symbol: 'ر.ق', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', flag: '🇶🇦', defaultRateAgainstEGP: 13.85, defaultRateToBase: 13.85 },
  { code: 'GBP', symbol: '£', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', flag: '🇬🇧', defaultRateAgainstEGP: 64.8, defaultRateToBase: 64.8 },
  { code: 'TRY', symbol: '₺', nameAr: 'ليرة تركية', nameEn: 'Turkish Lira', flag: '🇹🇷', defaultRateAgainstEGP: 1.45, defaultRateToBase: 1.45 },
];

/**
 * Loads exchange rates for a given tenant, populating default rates if not yet stored.
 */
export async function getOrInitExchangeRates(
  tenantId: string,
  baseCurrency = 'EGP'
): Promise<CurrencyExchangeRate[]> {
  try {
    const existing = await tenantStorage.getExchangeRates(tenantId);
    if (existing && existing.length > 0) {
      return existing;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const initialRates: CurrencyExchangeRate[] = SUPPORTED_CURRENCIES.map((curr) => ({
      id: `rate_${tenantId}_${curr.code}`,
      tenantId,
      currency: curr.code,
      symbol: curr.symbol,
      nameAr: curr.nameAr,
      nameEn: curr.nameEn,
      flag: curr.flag,
      rateAgainstBase: curr.code === baseCurrency ? 1.0 : curr.defaultRateAgainstEGP,
      isBaseCurrency: curr.code === baseCurrency,
      date: todayStr,
      updatedAt: Date.now(),
    }));

    await tenantStorage.saveMultipleExchangeRates(initialRates);
    return initialRates;
  } catch (err) {
    console.error('[Currency] Failed to load or init exchange rates:', err);
    return [];
  }
}

/**
 * Converts an amount from a given currency to the workshop base currency.
 * If currency is already base currency or rate is not found / 1, returns original amount.
 */
export function convertToBaseCurrency(
  amount: number,
  currencyCode: string,
  exchangeRates: CurrencyExchangeRate[],
  baseCurrencyCode = 'EGP'
): { baseAmount: number; rateUsed: number } {
  if (!amount || isNaN(amount)) {
    return { baseAmount: 0, rateUsed: 1 };
  }

  if (currencyCode === baseCurrencyCode) {
    return { baseAmount: amount, rateUsed: 1 };
  }

  const foundRate = exchangeRates.find((r) => r.currency === currencyCode);
  const rate = foundRate ? Number(foundRate.rateAgainstBase) || 1 : 1;
  const baseAmount = Math.round(amount * rate * 100) / 100;

  return { baseAmount, rateUsed: rate };
}

/**
 * Formats an amount with currency code or symbol.
 */
export function formatCurrencyAmount(
  amount: number,
  currencyCode: string,
  symbol?: string
): string {
  const sym = symbol || SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode)?.symbol || currencyCode;
  const numStr = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${numStr} ${sym}`;
}

export const CUSTOMER_DISPLAY_CURRENCY_KEY = 'alshams_customer_display_currency';

export function getCurrencyInfo(code?: string): CurrencyMetadata {
  const upper = String(code || 'EGP').trim().toUpperCase();
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === upper || c.symbol === code) ||
    SUPPORTED_CURRENCIES[0]
  );
}

/**
 * Converts an amount in any supported currency TO Egyptian Pounds (EGP),
 * which is the unified base currency of سوق الشمساوية.
 */
export function toEgpAmount(amount: number, sourceCurrency = 'EGP'): number {
  const numeric = Number(amount) || 0;
  if (numeric <= 0) return 0;
  const meta = getCurrencyInfo(sourceCurrency);
  if (meta.code === 'EGP') return Math.round(numeric * 100) / 100;
  return Math.round(numeric * meta.defaultRateAgainstEGP);
}

/**
 * Converts an amount from Egyptian Pounds (EGP) TO any customer display currency.
 */
export function fromEgpAmount(egpAmount: number, targetCurrency = 'EGP'): number {
  const numeric = Number(egpAmount) || 0;
  if (numeric <= 0) return 0;
  const meta = getCurrencyInfo(targetCurrency);
  if (meta.code === 'EGP') return Math.round(numeric * 100) / 100;
  const converted = numeric / (meta.defaultRateAgainstEGP || 1);
  return converted >= 100 ? Math.round(converted) : Math.round(converted * 100) / 100;
}

/**
 * Converts seamlessly between any two supported currencies via EGP.
 */
export function convertBetweenCurrencies(
  amount: number,
  fromCurrency = 'EGP',
  toCurrency = 'EGP'
): number {
  const fromMeta = getCurrencyInfo(fromCurrency);
  const toMeta = getCurrencyInfo(toCurrency);
  if (fromMeta.code === toMeta.code) return Number(amount) || 0;
  const egp = toEgpAmount(amount, fromMeta.code);
  return fromEgpAmount(egp, toMeta.code);
}

export function getStoredCustomerDisplayCurrency(): string {
  try {
    if (typeof window === 'undefined') return 'EGP';
    const raw = localStorage.getItem(CUSTOMER_DISPLAY_CURRENCY_KEY);
    return raw ? getCurrencyInfo(raw).code : 'EGP';
  } catch {
    return 'EGP';
  }
}

export function saveStoredCustomerDisplayCurrency(code: string): string {
  const resolved = getCurrencyInfo(code).code;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CUSTOMER_DISPLAY_CURRENCY_KEY, resolved);
      window.dispatchEvent(new CustomEvent('alshams_customer_currency_updated', { detail: resolved }));
    }
  } catch {}
  return resolved;
}

