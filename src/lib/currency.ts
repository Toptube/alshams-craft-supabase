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
const BUILDER_FX_STORAGE_KEY = 'alshams_market_builder_v1';

interface CachedFxState {
  rates: Record<string, number>;
  silentBankBufferPercent: number;
  readAt: number;
}

let cachedFxState: CachedFxState | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('alshams_market_builder_updated', () => {
    cachedFxState = null;
  });
  window.addEventListener('storage', (e) => {
    if (e.key === BUILDER_FX_STORAGE_KEY) {
      cachedFxState = null;
    }
  });
}

function getActiveFxState(): CachedFxState {
  const now = Date.now();
  if (cachedFxState && now - cachedFxState.readAt < 3000) {
    return cachedFxState;
  }
  const defaults: Record<string, number> = {};
  SUPPORTED_CURRENCIES.forEach((c) => {
    defaults[c.code] = c.defaultRateAgainstEGP;
  });
  let silentBankBufferPercent = 2.5;
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(BUILDER_FX_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const fx = parsed?.fxConfig;
        if (fx && typeof fx === 'object') {
          if (fx.ratesAgainstEgp && typeof fx.ratesAgainstEgp === 'object') {
            Object.entries(fx.ratesAgainstEgp).forEach(([k, v]) => {
              const num = Number(v);
              if (num > 0 && Number.isFinite(num)) {
                defaults[k.toUpperCase()] = num;
              }
            });
          }
          if (fx.silentBankBufferPercent !== undefined) {
            const pct = Number(fx.silentBankBufferPercent);
            if (Number.isFinite(pct) && pct >= 0 && pct <= 25) {
              silentBankBufferPercent = pct;
            }
          }
        }
      }
    }
  } catch {}
  defaults.EGP = 1.0;
  cachedFxState = { rates: defaults, silentBankBufferPercent, readAt: now };
  return cachedFxState;
}

export function getCurrencyInfo(code?: string): CurrencyMetadata {
  const upper = String(code || 'EGP').trim().toUpperCase();
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === upper || c.symbol === code) ||
    SUPPORTED_CURRENCIES[0]
  );
}

export function getLiveCurrencyRateAgainstEgp(code?: string): number {
  const meta = getCurrencyInfo(code);
  if (meta.code === 'EGP') return 1.0;
  const fx = getActiveFxState();
  return fx.rates[meta.code] || meta.defaultRateAgainstEGP || 1;
}

export function getSilentFxBufferPercent(): number {
  return getActiveFxState().silentBankBufferPercent;
}

/**
 * Converts an amount in any supported currency TO Egyptian Pounds (EGP),
 * using the Super Admin live FX table as the unified base of سوق الشمساوية.
 */
export function toEgpAmount(amount: number, sourceCurrency = 'EGP'): number {
  const numeric = Number(amount) || 0;
  if (numeric <= 0) return 0;
  const meta = getCurrencyInfo(sourceCurrency);
  if (meta.code === 'EGP') return Math.round(numeric * 100) / 100;
  const liveRate = getLiveCurrencyRateAgainstEgp(meta.code);
  return Math.round(numeric * liveRate);
}

/**
 * Converts an amount from Egyptian Pounds (EGP) TO any customer display currency,
 * silently protecting the artist from bank FX conversion fees via Super Admin buffer.
 */
export function fromEgpAmount(
  egpAmount: number,
  targetCurrency = 'EGP',
  includeSilentFxBuffer = true
): number {
  const numeric = Number(egpAmount) || 0;
  if (numeric <= 0) return 0;
  const meta = getCurrencyInfo(targetCurrency);
  if (meta.code === 'EGP') return Math.round(numeric * 100) / 100;
  const liveRate = getLiveCurrencyRateAgainstEgp(meta.code);
  const bufferPct = includeSilentFxBuffer ? getSilentFxBufferPercent() : 0;
  const multiplier = 1 + Math.max(0, bufferPct) / 100;
  const converted = (numeric / (liveRate || 1)) * multiplier;
  return converted >= 100 ? Math.round(converted) : Math.round(converted * 100) / 100;
}

/**
 * Converts seamlessly between any two supported currencies via EGP,
 * silently applying the protection buffer whenever currency differs from seller's local currency.
 */
export function convertBetweenCurrencies(
  amount: number,
  fromCurrency = 'EGP',
  toCurrency = 'EGP',
  includeSilentFxBuffer = true
): number {
  const numeric = Number(amount) || 0;
  if (numeric <= 0) return 0;
  const fromMeta = getCurrencyInfo(fromCurrency);
  const toMeta = getCurrencyInfo(toCurrency);
  if (fromMeta.code === toMeta.code) return numeric;
  const egp = toEgpAmount(numeric, fromMeta.code);
  if (toMeta.code === 'EGP') {
    const bufferPct = includeSilentFxBuffer ? getSilentFxBufferPercent() : 0;
    const multiplier = 1 + Math.max(0, bufferPct) / 100;
    const converted = egp * multiplier;
    return converted >= 100 ? Math.round(converted) : Math.round(converted * 100) / 100;
  }
  return fromEgpAmount(egp, toMeta.code, includeSilentFxBuffer);
}

/**
 * Automatically detects the visitor's local currency from browser timezone/locale
 * when they have not manually selected a currency yet.
 */
export function detectVisitorDefaultCurrency(): string {
  try {
    if (typeof window === 'undefined') return 'EGP';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = (navigator.language || '').toLowerCase();

    if (tz === 'Africa/Cairo' || lang.includes('-eg')) return 'EGP';
    if (tz === 'Asia/Riyadh' || lang.includes('-sa')) return 'SAR';
    if (tz === 'Asia/Dubai' || lang.includes('-ae')) return 'AED';
    if (tz === 'Asia/Kuwait' || lang.includes('-kw')) return 'KWD';
    if (tz === 'Asia/Qatar' || lang.includes('-qa')) return 'QAR';
    if (tz === 'Europe/London' || lang.includes('-gb')) return 'GBP';
    if (tz === 'Europe/Istanbul' || lang.startsWith('tr')) return 'TRY';
    if (tz.startsWith('Europe/')) return 'EUR';
    if (tz.startsWith('America/') || lang.includes('-us')) return 'USD';
    if (lang.startsWith('ar')) return 'EGP';
  } catch {}
  return 'EGP';
}

export function getStoredCustomerDisplayCurrency(): string {
  try {
    if (typeof window === 'undefined') return 'EGP';
    const raw = localStorage.getItem(CUSTOMER_DISPLAY_CURRENCY_KEY);
    if (raw) return getCurrencyInfo(raw).code;
    return detectVisitorDefaultCurrency();
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

