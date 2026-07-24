import type {
  CarCurrencyConfig,
  CarCurrencyPricing,
  CurrencyCode,
  CurrencySetting,
  Car,
} from '../types';

/**
 * Moteur de devises.
 *
 * Règle d'or : **le DZD est la devise de vérité**. Tout ce qui est stocké en
 * base (total d'une réservation, dépenses, salaires) est en DZD. Les autres
 * devises ne sont qu'un affichage, obtenu en divisant par le taux.
 *
 *   montantDevise = montantDzd / rateToDzd
 *   montantDzd    = montantDevise * rateToDzd
 */

export const BASE_CURRENCY: CurrencyCode = 'DZD';

export const CURRENCY_ORDER: CurrencyCode[] = ['DZD', 'USD', 'EUR', 'GBP'];

/** Métadonnées statiques — le taux réel vient toujours de la base. */
export const CURRENCY_META: Record<CurrencyCode, { label: string; symbol: string; flag: string; locale: string }> = {
  DZD: { label: 'Dinar algérien',   symbol: 'DA', flag: '🇩🇿', locale: 'fr-DZ' },
  USD: { label: 'Dollar américain', symbol: '$',  flag: '🇺🇸', locale: 'en-US' },
  EUR: { label: 'Euro',             symbol: '€',  flag: '🇪🇺', locale: 'fr-FR' },
  GBP: { label: 'Livre sterling',   symbol: '£',  flag: '🇬🇧', locale: 'en-GB' },
};

/** Devises par défaut si la table `currency_settings` n'a pas encore été lue. */
export const DEFAULT_CURRENCIES: CurrencySetting[] = [
  { code: 'DZD', label: CURRENCY_META.DZD.label, symbol: 'DA', rateToDzd: 1,     isActive: true,  isBase: true,  displayOrder: 0 },
  { code: 'USD', label: CURRENCY_META.USD.label, symbol: '$',  rateToDzd: 134.5, isActive: false, isBase: false, displayOrder: 1 },
  { code: 'EUR', label: CURRENCY_META.EUR.label, symbol: '€',  rateToDzd: 145,   isActive: false, isBase: false, displayOrder: 2 },
  { code: 'GBP', label: CURRENCY_META.GBP.label, symbol: '£',  rateToDzd: 170,   isActive: false, isBase: false, displayOrder: 3 },
];

export const isCurrencyCode = (v: unknown): v is CurrencyCode =>
  typeof v === 'string' && (CURRENCY_ORDER as string[]).includes(v);

/** Convertit un montant DZD vers `rate` (DZD par unité). */
export const fromDzd = (amountDzd: number, rate: number): number => {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return Number(amountDzd) || 0;
  return (Number(amountDzd) || 0) / r;
};

/** Convertit un montant exprimé dans une devise vers le DZD. */
export const toDzd = (amount: number, rate: number): number => {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return Number(amount) || 0;
  return (Number(amount) || 0) * r;
};

/**
 * Formate un montant DANS SA PROPRE devise (aucune conversion).
 * Le DZD s'affiche sans décimale, les devises étrangères avec deux.
 */
export const formatCurrency = (
  amount: number,
  code: CurrencyCode = BASE_CURRENCY,
  opts: { symbol?: string; compact?: boolean } = {}
): string => {
  const meta = CURRENCY_META[code] ?? CURRENCY_META.DZD;
  const symbol = opts.symbol ?? meta.symbol;
  const value = Number(amount) || 0;
  const decimals = code === 'DZD' ? 0 : 2;

  const formatted = value.toLocaleString('fr-FR', {
    minimumFractionDigits: opts.compact ? 0 : decimals,
    maximumFractionDigits: decimals,
  });

  // Le dinar se postfixe ("12 000 DA"), les autres se préfixent ("$ 89.00").
  return code === 'DZD' ? `${formatted} ${symbol}` : `${symbol} ${formatted}`;
};

/** Formate un montant STOCKÉ EN DZD dans la devise demandée. */
export const formatFromDzd = (
  amountDzd: number,
  currency: Pick<CurrencySetting, 'code' | 'symbol' | 'rateToDzd'>
): string =>
  formatCurrency(fromDzd(amountDzd, currency.rateToDzd), currency.code, { symbol: currency.symbol });

/** Arrondi d'affichage : entier en DZD, 2 décimales ailleurs. */
export const roundForCurrency = (amount: number, code: CurrencyCode): number => {
  const v = Number(amount) || 0;
  return code === 'DZD' ? Math.round(v) : Math.round(v * 100) / 100;
};

/**
 * Dérive les tarifs d'une devise depuis les prix DZD de la voiture.
 * Utilisé quand l'utilisateur saisit un taux de change dans le formulaire
 * véhicule : jour / semaine / mois / caution se remplissent tout seuls.
 */
export const derivePricingFromRate = (
  car: Pick<Car, 'priceDay' | 'priceWeek' | 'priceMonth' | 'deposit'>,
  rate: number,
  code: Exclude<CurrencyCode, 'DZD'>
): Omit<CarCurrencyPricing, 'active' | 'rate'> => ({
  priceDay:   roundForCurrency(fromDzd(car.priceDay   || 0, rate), code),
  priceWeek:  roundForCurrency(fromDzd(car.priceWeek  || 0, rate), code),
  priceMonth: roundForCurrency(fromDzd(car.priceMonth || 0, rate), code),
  deposit:    roundForCurrency(fromDzd(car.deposit    || 0, rate), code),
});

/**
 * Tarifs d'une voiture dans une devise donnée.
 * Ordre de priorité :
 *   1. la config par voiture si la devise y est activée (l'agence a pu arrondir) ;
 *   2. sinon une conversion à la volée avec le taux global ;
 *   3. `null` si la devise n'est pas disponible pour cette voiture.
 */
export const getCarPricing = (
  car: Car,
  code: CurrencyCode,
  globalRate?: number
): { priceDay: number; priceWeek: number; priceMonth: number; deposit: number; rate: number } | null => {
  if (code === 'DZD') {
    return {
      priceDay: car.priceDay || 0,
      priceWeek: car.priceWeek || 0,
      priceMonth: car.priceMonth || 0,
      deposit: car.deposit || 0,
      rate: 1,
    };
  }

  const cfg = car.currencyConfig?.[code as Exclude<CurrencyCode, 'DZD'>];
  if (cfg?.active) {
    return {
      priceDay: cfg.priceDay,
      priceWeek: cfg.priceWeek,
      priceMonth: cfg.priceMonth,
      deposit: cfg.deposit,
      rate: cfg.rate,
    };
  }

  if (globalRate && globalRate > 0) {
    return { ...derivePricingFromRate(car, globalRate, code as Exclude<CurrencyCode, 'DZD'>), rate: globalRate };
  }

  return null;
};

/** Devises réellement proposées pour une voiture (DZD toujours en tête). */
export const getCarCurrencies = (car: Car, active: CurrencySetting[]): CurrencySetting[] =>
  active.filter(c => c.isBase || c.code === 'DZD' || car.currencyConfig?.[c.code as Exclude<CurrencyCode, 'DZD'>]?.active);

/** Normalise la config devises lue depuis la base (jsonb parfois string). */
export const parseCurrencyConfig = (raw: unknown): CarCurrencyConfig => {
  if (!raw) return {};
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return {}; }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) return {};

  const out: CarCurrencyConfig = {};
  (['USD', 'EUR', 'GBP'] as const).forEach(code => {
    const v = obj[code];
    if (!v || typeof v !== 'object') return;
    out[code] = {
      active: Boolean(v.active),
      rate: Number(v.rate) || 0,
      priceDay: Number(v.priceDay) || 0,
      priceWeek: Number(v.priceWeek) || 0,
      priceMonth: Number(v.priceMonth) || 0,
      deposit: Number(v.deposit) || 0,
    };
  });
  return out;
};
