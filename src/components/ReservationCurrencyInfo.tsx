import React from 'react';
import { Coins, Ticket } from 'lucide-react';
import type { Language, ReservationDetails } from '../types';
import { CURRENCY_META, formatCurrency } from '../utils/currency';

interface Props {
  /**
   * Réservation ou commande site. Volontairement large : ce composant accepte
   * aussi bien la forme mappée (camelCase) que la ligne brute (snake_case),
   * et les deux modèles n'ont pas exactement les mêmes statuts.
   */
  reservation: Record<string, any>;
  lang: Language;
  /** `inline` : deux pastilles compactes. `panel` : encart détaillé. */
  variant?: 'inline' | 'panel';
  className?: string;
}

const dzd = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} DA`;

/**
 * Affiche la devise de réservation et le code promo d'une commande.
 *
 * Règles :
 *   • la devise n'est montrée que si le client a réservé AUTREMENT qu'en
 *     dinars — sinon il n'y a rien à convertir ;
 *   • le bloc « code promo » n'est rendu QUE si un code a réellement été
 *     utilisé. Aucun libellé vide, aucun « — » : si absent, rien du tout.
 *
 * Utilisé par « Commandes Website » et par le planificateur.
 */
export const ReservationCurrencyInfo: React.FC<Props> = ({
  reservation, lang, variant = 'inline', className = '',
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  // Accepte aussi bien la forme mappée (camelCase) que la ligne brute.
  const code = (reservation.currencyCode ?? reservation.currency_code ?? 'DZD') as string;
  const rate = Number(reservation.currencyRate ?? reservation.currency_rate) || 1;
  const totalDzd = Number(reservation.totalPrice ?? reservation.total_price) || 0;
  const totalCur = reservation.totalPriceCurrency ?? reservation.total_price_currency;

  const promoCode = reservation.promoCode ?? reservation.promo_code;
  const promoPct = Number(reservation.promoDiscountPercentage ?? reservation.promo_discount_percentage) || 0;
  const promoAmount = Number(reservation.promoDiscountAmount ?? reservation.promo_discount_amount) || 0;

  const foreign = code !== 'DZD' && rate > 0;
  const hasPromo = Boolean(promoCode && String(promoCode).trim());

  // Ni devise étrangère ni promo → ce composant n'a rien à dire.
  if (!foreign && !hasPromo) return null;

  const meta = CURRENCY_META[code as keyof typeof CURRENCY_META];
  const amountInCurrency =
    totalCur != null ? Number(totalCur) : rate > 0 ? totalDzd / rate : totalDzd;

  // ── Pastilles compactes ────────────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {foreign && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
            style={{ background: 'var(--color-gold-soft)', color: 'var(--color-gold)' }}
            title={`1 ${meta?.symbol ?? code} = ${rate} DA`}
          >
            <Coins size={11} />
            {meta?.flag} {formatCurrency(amountInCurrency, code as any, { symbol: meta?.symbol })}
            <span style={{ color: 'var(--color-text-dim)' }}>≈ {dzd(totalDzd)}</span>
          </span>
        )}

        {hasPromo && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
            style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-act-success)' }}
          >
            <Ticket size={11} />
            {String(promoCode).toUpperCase()}
            {promoPct > 0 && ` −${promoPct}%`}
            {promoAmount > 0 && ` (−${dzd(promoAmount)})`}
          </span>
        )}
      </div>
    );
  }

  // ── Encart détaillé ────────────────────────────────────────────────────
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }}
    >
      {foreign && (
        <div className="px-4 py-3" style={{ borderBottom: hasPromo ? '1px solid var(--color-border-soft)' : undefined }}>
          <p
            className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Coins size={12} /> {T('Devise de la réservation', 'عملة الحجز')}
          </p>

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {meta?.flag} {T('Montant payé par le client', 'المبلغ الذي دفعه العميل')}
            </span>
            <span className="text-lg font-black" style={{ color: 'var(--color-gold)' }}>
              {formatCurrency(amountInCurrency, code as any, { symbol: meta?.symbol })}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-3 mt-1">
            <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              {T('Équivalent en dinars', 'المعادل بالدينار')} — {T('taux figé', 'سعر ثابت')} : 1 {meta?.symbol ?? code} = {rate} DA
            </span>
            <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
              {dzd(totalDzd)}
            </span>
          </div>
        </div>
      )}

      {hasPromo && (
        <div className="px-4 py-3">
          <p
            className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Ticket size={12} /> {T('Code promo utilisé', 'رمز الخصم المستخدم')}
          </p>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono font-black tracking-widest text-sm" style={{ color: 'var(--color-act-success)' }}>
              {String(promoCode).toUpperCase()}
            </span>
            <span className="text-sm font-bold" style={{ color: 'var(--color-act-success)' }}>
              {promoPct > 0 && `−${promoPct}%`}
              {promoAmount > 0 && ` · −${dzd(promoAmount)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationCurrencyInfo;
