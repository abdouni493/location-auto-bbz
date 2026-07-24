import React from 'react';
import { motion } from 'motion/react';
import type { Car, CurrencySetting, Language, SpecialOffer } from '../../types';
import { useCurrency } from './CurrencyContext';
import { CURRENCY_META, formatCurrency, fromDzd, roundForCurrency, getCarPricing } from '../../utils/currency';

interface CarPriceBlockProps {
  car: Car;
  lang: Language;
  /** Promotion en cours (le prix jour est alors barré). */
  promo?: SpecialOffer | null;
  /** `card` : compact (grille). `detail` : aéré (fiche véhicule). */
  variant?: 'card' | 'detail';
}

const L = (lang: Language) => ({
  day:     { fr: 'Jour',    ar: 'يوم' }[lang],
  week:    { fr: 'Semaine', ar: 'أسبوع' }[lang],
  month:   { fr: 'Mois',    ar: 'شهر' }[lang],
  deposit: { fr: 'Caution', ar: 'الكفالة' }[lang],
});

/**
 * Bloc tarifaire d'une voiture.
 *
 * • Une seule devise sélectionnée → un tableau simple jour / semaine / mois / caution.
 * • « Toutes les devises »        → une colonne par devise, alignée sur les mêmes
 *   lignes, pour que les montants restent comparables d'un coup d'œil.
 *
 * Les tarifs viennent de la config par voiture quand elle existe (l'agence a pu
 * arrondir), sinon d'une conversion au taux global.
 */
export const CarPriceBlock: React.FC<CarPriceBlockProps> = ({
  car, lang, promo = null, variant = 'card',
}) => {
  const { currenciesForCar, selected } = useCurrency();
  const labels = L(lang);
  const list = currenciesForCar(car);
  const compact = variant === 'card';

  if (list.length === 0) return null;

  /** Prix jour promotionnel converti dans la devise voulue. */
  const promoDayIn = (cur: CurrencySetting): number | null => {
    if (!promo) return null;
    return roundForCurrency(fromDzd(promo.newPrice, cur.rateToDzd), cur.code);
  };

  const rows: { key: 'priceDay' | 'priceWeek' | 'priceMonth' | 'deposit'; label: string }[] = [
    { key: 'priceDay',   label: labels.day },
    { key: 'priceWeek',  label: labels.week },
    { key: 'priceMonth', label: labels.month },
    { key: 'deposit',    label: labels.deposit },
  ];

  // ── Une seule devise : liste verticale compacte ─────────────────────────
  if (list.length === 1) {
    const cur = list[0];
    const pricing = getCarPricing(car, cur.code, cur.rateToDzd);
    if (!pricing) return null;

    const fmt = (n: number) => formatCurrency(n, cur.code, { symbol: cur.symbol });
    const promoDay = promoDayIn(cur);

    return (
      <div
        className={`rounded-lg ${compact ? 'px-2.5 py-2 space-y-1' : 'px-4 py-3 space-y-2'} mt-auto`}
        style={{ background: 'var(--color-gold-soft)', border: '1px solid var(--color-vel-border-gold)' }}
      >
        {rows.map((row, i) => {
          const isDay = row.key === 'priceDay';
          const isDeposit = row.key === 'deposit';
          return (
            <div
              key={row.key}
              className={`flex justify-between items-baseline ${compact ? 'text-[10px]' : 'text-sm'} ${isDeposit ? 'pt-1' : ''}`}
              style={isDeposit ? { borderTop: '1px solid var(--color-border-soft)' } : undefined}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
              {isDay && promoDay !== null ? (
                <span className={`font-black ${compact ? 'text-xs' : 'text-base'}`} style={{ color: 'var(--color-gold)' }}>
                  <span className="line-through mr-1 font-medium" style={{ color: 'var(--color-text-dim)' }}>
                    {fmt(pricing.priceDay)}
                  </span>
                  {fmt(promoDay)}
                </span>
              ) : (
                <span
                  className={isDay ? `font-black ${compact ? 'text-xs' : 'text-base'}` : 'font-bold'}
                  style={{
                    color: isDay
                      ? 'var(--color-gold)'
                      : isDeposit
                        ? 'var(--color-act-warning)'
                        : 'var(--color-text-soft)',
                  }}
                >
                  {fmt(pricing[row.key])}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Plusieurs devises : une colonne par devise ──────────────────────────
  return (
    <div
      className={`rounded-lg overflow-hidden mt-auto ${compact ? '' : 'text-sm'}`}
      style={{ background: 'var(--color-gold-soft)', border: '1px solid var(--color-vel-border-gold)' }}
    >
      {/* En-tête : les devises */}
      <div
        className={`grid gap-1 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
        style={{
          gridTemplateColumns: `minmax(0,1.1fr) repeat(${list.length}, minmax(0,1fr))`,
          borderBottom: '1px solid var(--color-border-soft)',
        }}
      >
        <span />
        {list.map(cur => (
          <span
            key={cur.code}
            className={`text-center font-black ${compact ? 'text-[9px]' : 'text-[11px]'} uppercase tracking-wide`}
            style={{ color: 'var(--color-gold)' }}
            title={cur.isBase ? undefined : `1 ${cur.symbol} = ${cur.rateToDzd} DA`}
          >
            {CURRENCY_META[cur.code]?.flag} {cur.code}
          </span>
        ))}
      </div>

      {/* Lignes tarifaires */}
      {rows.map(row => {
        const isDay = row.key === 'priceDay';
        const isDeposit = row.key === 'deposit';

        return (
          <div
            key={row.key}
            className={`grid gap-1 items-baseline ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
            style={{
              gridTemplateColumns: `minmax(0,1.1fr) repeat(${list.length}, minmax(0,1fr))`,
              borderTop: isDeposit ? '1px solid var(--color-border-soft)' : undefined,
            }}
          >
            <span className={compact ? 'text-[9px]' : 'text-xs'} style={{ color: 'var(--color-text-muted)' }}>
              {row.label}
            </span>

            {list.map(cur => {
              const pricing = getCarPricing(car, cur.code, cur.rateToDzd);
              if (!pricing) {
                return (
                  <span key={cur.code} className="text-center" style={{ color: 'var(--color-text-dim)' }}>—</span>
                );
              }

              const fmt = (n: number) =>
                formatCurrency(n, cur.code, { symbol: cur.symbol, compact: true });
              const promoDay = isDay ? promoDayIn(cur) : null;

              return (
                <span
                  key={cur.code}
                  className={`text-center whitespace-nowrap ${
                    isDay ? `font-black ${compact ? 'text-[10px]' : 'text-sm'}` : compact ? 'text-[9px] font-bold' : 'text-xs font-bold'
                  }`}
                  style={{
                    color: isDay
                      ? 'var(--color-gold)'
                      : isDeposit
                        ? 'var(--color-act-warning)'
                        : 'var(--color-text-soft)',
                  }}
                >
                  {promoDay !== null ? (
                    <>
                      <span className="line-through block font-medium" style={{ color: 'var(--color-text-dim)', fontSize: '0.85em' }}>
                        {fmt(pricing.priceDay)}
                      </span>
                      {fmt(promoDay)}
                    </>
                  ) : (
                    fmt(pricing[row.key])
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default CarPriceBlock;
