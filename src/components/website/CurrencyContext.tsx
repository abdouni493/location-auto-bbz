import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Car, CurrencyCode, CurrencySetting } from '../../types';
import { CurrencyService } from '../../services/currencyService';
import {
  DEFAULT_CURRENCIES,
  formatCurrency,
  fromDzd,
  getCarPricing,
  roundForCurrency,
} from '../../utils/currency';

/**
 * Devise d'affichage du site public.
 *
 * `selected = 'ALL'` affiche les prix dans TOUTES les devises actives (mode
 * vitrine). Sinon le site entier — cartes, wizard, récapitulatif — n'affiche
 * plus que la devise choisie.
 *
 * Les prix en base restent en dinars : on ne fait que convertir à l'affichage.
 */

export type CurrencySelection = CurrencyCode | 'ALL';

interface CurrencyContextValue {
  /** Devises activées par l'agence (DZD toujours présent). */
  currencies: CurrencySetting[];
  /** Sélection courante ('ALL' = toutes). */
  selected: CurrencySelection;
  setSelected: (v: CurrencySelection) => void;
  /** Devise effective pour un calcul (jamais 'ALL' : retombe sur DZD). */
  active: CurrencySetting;
  isLoading: boolean;

  /** Convertit un montant DZD et le formate dans la devise courante. */
  price: (amountDzd: number) => string;
  /** Convertit sans formater. */
  convert: (amountDzd: number) => number;
  /** Formate dans une devise précise. */
  priceIn: (amountDzd: number, code: CurrencyCode) => string;
  /** Devises à afficher sur une carte véhicule, selon la sélection. */
  currenciesForCar: (car: Car) => CurrencySetting[];
}

const DZD = DEFAULT_CURRENCIES[0];

const CurrencyContext = createContext<CurrencyContextValue>({
  currencies: [DZD],
  selected: 'DZD',
  setSelected: () => {},
  active: DZD,
  isLoading: false,
  price: a => formatCurrency(a, 'DZD'),
  convert: a => a,
  priceIn: a => formatCurrency(a, 'DZD'),
  currenciesForCar: () => [DZD],
});

const STORAGE_KEY = 'mhd-auto-website-currency';

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currencies, setCurrencies] = useState<CurrencySetting[]>([DZD]);
  const [selected, setSelectedState] = useState<CurrencySelection>('DZD');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    CurrencyService.getActive()
      .then(list => {
        if (cancelled) return;
        const active = list.length > 0 ? list : [DZD];
        setCurrencies(active);

        // Restaure le choix précédent s'il est toujours proposé.
        try {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          if (saved === 'ALL' || active.some(c => c.code === saved)) {
            setSelectedState(saved as CurrencySelection);
          }
        } catch {
          // localStorage indisponible — on garde le dinar.
        }
      })
      .catch(() => setCurrencies([DZD]))
      .finally(() => !cancelled && setIsLoading(false));

    return () => { cancelled = true; };
  }, []);

  const setSelected = (v: CurrencySelection) => {
    setSelectedState(v);
    try { window.localStorage.setItem(STORAGE_KEY, v); } catch { /* ignoré */ }
  };

  const value = useMemo<CurrencyContextValue>(() => {
    const active =
      selected === 'ALL'
        ? currencies.find(c => c.isBase) ?? DZD
        : currencies.find(c => c.code === selected) ?? DZD;

    const convert = (amountDzd: number) =>
      roundForCurrency(fromDzd(amountDzd, active.rateToDzd), active.code);

    const priceIn = (amountDzd: number, code: CurrencyCode) => {
      const cur = currencies.find(c => c.code === code) ?? DZD;
      return formatCurrency(
        roundForCurrency(fromDzd(amountDzd, cur.rateToDzd), cur.code),
        cur.code,
        { symbol: cur.symbol }
      );
    };

    /**
     * Devises affichables pour une voiture donnée.
     * En mode 'ALL', on ne montre que celles réellement activées sur CETTE
     * voiture (plus le dinar) — inutile d'afficher un prix en livres si
     * l'agence n'a pas paramétré la livre pour ce véhicule.
     */
    const currenciesForCar = (car: Car): CurrencySetting[] => {
      if (selected !== 'ALL') return [active];
      return currencies.filter(
        c => c.isBase || c.code === 'DZD' || getCarPricing(car, c.code, c.rateToDzd) !== null
      );
    };

    return {
      currencies,
      selected,
      setSelected,
      active,
      isLoading,
      price: (amountDzd: number) =>
        formatCurrency(convert(amountDzd), active.code, { symbol: active.symbol }),
      convert,
      priceIn,
      currenciesForCar,
    };
  }, [currencies, selected, isLoading]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => useContext(CurrencyContext);

/**
 * Prix d'une voiture dans une devise donnée.
 * Utilise le tarif paramétré sur la voiture s'il existe (l'agence a pu
 * arrondir), sinon convertit le prix en dinars au taux global.
 */
export const useCarPrice = () => {
  const { currencies } = useCurrency();

  return (car: Car, currency: CurrencySetting) => {
    const pricing = getCarPricing(car, currency.code, currency.rateToDzd);
    if (!pricing) return null;

    const fmt = (n: number) => formatCurrency(n, currency.code, { symbol: currency.symbol });
    return {
      ...pricing,
      formatted: {
        day: fmt(pricing.priceDay),
        week: fmt(pricing.priceWeek),
        month: fmt(pricing.priceMonth),
        deposit: fmt(pricing.deposit),
      },
    };
  };
};
