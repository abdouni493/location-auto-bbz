import React from 'react';
import { Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Language } from '../../types';

interface Props {
  lang: Language;
  /** Total de la location AVANT frais de clôture. */
  baseTotal: number;
  /** Frais supplémentaires (kilométrage + carburant). */
  extraFees: number;
  /**
   * Services obligatoires facturés mais non fournis : leur montant est rendu
   * au client, donc déduit du total dû.
   */
  serviceCredits?: number;
  /** Déjà encaissé avant cette clôture. */
  alreadyPaid: number;
  /** Montant encaissé À L'INSTANT (saisi par l'agent). */
  payNow: number | '';
  onPayNowChange: (v: number | '') => void;
  paymentMethod: string;
  onPaymentMethodChange: (v: string) => void;
}

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} DA`;

/**
 * Bilan financier de la clôture d'une location.
 *
 * Enchaîne : total → frais supplémentaires → total dû → déjà payé →
 * encaissement du jour → reste. Le reste se recalcule à chaque frappe pour que
 * l'agent voie immédiatement s'il solde le dossier ou non.
 */
export const TerminationPaymentPanel: React.FC<Props> = ({
  lang, baseTotal, extraFees, serviceCredits = 0, alreadyPaid,
  payNow, onPayNowChange, paymentMethod, onPaymentMethodChange,
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const credits = Math.max(0, Number(serviceCredits) || 0);
  const totalDue = Math.max(0, baseTotal + extraFees - credits);
  const paidNow = payNow === '' ? 0 : Number(payNow) || 0;
  const remaining = Math.max(0, totalDue - alreadyPaid - paidNow);
  const isSettled = remaining <= 0;
  // L'agent a encaissé plus que le reste dû : à signaler, pas à bloquer.
  const overpaid = alreadyPaid + paidNow - totalDue;

  const row = (label: string, value: string, color?: string, bold = false) => (
    <div className="flex justify-between items-baseline gap-3 py-2">
      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        className={bold ? 'font-black text-lg' : 'font-bold text-sm'}
        style={{ color: color ?? 'var(--color-text)' }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <header
        className="px-5 py-3.5 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid var(--color-border-soft)', background: 'var(--color-surface-2)' }}
      >
        <span className="p-1.5 rounded-lg" style={{ background: 'rgba(20,184,166,0.15)', color: 'var(--color-act-payment)' }}>
          <Wallet size={16} />
        </span>
        <h4 className="font-black text-sm uppercase tracking-tight" style={{ color: 'var(--color-text)' }}>
          {T('Règlement de la location', 'تسوية الإيجار')}
        </h4>
      </header>

      <div className="p-5 space-y-1">
        {row(T('Total de la location', 'إجمالي الإيجار'), money(baseTotal))}

        {extraFees > 0 &&
          row(T('Frais supplémentaires', 'رسوم إضافية'), `+ ${money(extraFees)}`, 'var(--color-act-warning)')}

        {credits > 0 &&
          row(
            T('Services obligatoires rendus', 'خدمات إلزامية مُعادة'),
            `− ${money(credits)}`,
            'var(--color-act-success)'
          )}

        <div style={{ borderTop: '1px solid var(--color-border-soft)' }}>
          {row(T('Total à payer', 'الإجمالي المستحق'), money(totalDue), 'var(--color-gold)', true)}
        </div>

        {row(T('Déjà payé', 'المدفوع سابقًا'), `− ${money(alreadyPaid)}`, 'var(--color-act-success)')}

        {/* Encaissement du jour */}
        <div className="pt-3 pb-1" style={{ borderTop: '1px dashed var(--color-border-soft)' }}>
          <label className="label-saas">{T("Montant encaissé maintenant", 'المبلغ المحصّل الآن')}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                value={payNow}
                onChange={e => onPayNowChange(e.target.value === '' ? '' : Number(e.target.value))}
                className="input-saas pr-12"
                placeholder="0"
              />
              <span
                className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none"
                style={{ color: 'var(--color-text-dim)' }}
              >
                DA
              </span>
            </div>

            <select
              value={paymentMethod}
              onChange={e => onPaymentMethodChange(e.target.value)}
              className="input-saas sm:!w-40"
            >
              <option value="cash">{T('Espèces', 'نقدًا')}</option>
              <option value="card">{T('Carte', 'بطاقة')}</option>
              <option value="transfer">{T('Virement', 'تحويل')}</option>
              <option value="check">{T('Chèque', 'شيك')}</option>
            </select>
          </div>

          {/* Raccourci : solder le dossier */}
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => onPayNowChange(Math.max(0, totalDue - alreadyPaid))}
              className="mt-2 text-[11px] font-bold underline cursor-pointer"
              style={{ color: 'var(--color-gold)' }}
            >
              {T(`Encaisser le solde (${money(totalDue - alreadyPaid)})`, `تحصيل الرصيد (${money(totalDue - alreadyPaid)})`)}
            </button>
          )}
        </div>

        {/* Reste dû */}
        <div
          className="mt-3 px-4 py-3.5 rounded-xl flex items-center justify-between gap-3"
          style={{
            background: isSettled ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)',
            border: `1px solid ${isSettled ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
          }}
        >
          <span
            className="flex items-center gap-2 font-black text-sm uppercase tracking-tight"
            style={{ color: isSettled ? 'var(--color-act-success)' : 'var(--color-act-warning)' }}
          >
            {isSettled ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {isSettled ? T('Dossier soldé', 'الملف مسدَّد') : T('Reste à payer', 'المتبقي')}
          </span>
          <span
            className="font-black text-2xl"
            style={{ color: isSettled ? 'var(--color-act-success)' : 'var(--color-act-warning)' }}
          >
            {money(remaining)}
          </span>
        </div>

        {overpaid > 0 && (
          <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--color-act-edit)' }}>
            <AlertTriangle size={12} />
            {T(
              `Trop-perçu de ${money(overpaid)} — à rembourser au client.`,
              `مبلغ زائد ${money(overpaid)} — يُعاد للعميل.`
            )}
          </p>
        )}
      </div>
    </section>
  );
};

export default TerminationPaymentPanel;
