import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Loader2, Undo2 } from 'lucide-react';
import type { Language } from '../../types';

/** Un service obligatoire facturé sur la réservation en cours de clôture. */
export interface MandatoryServiceRow {
  /** Identifiant de la ligne `reservation_services`. */
  id: string;
  name: string;
  price: number;
}

interface Props {
  lang: Language;
  services: MandatoryServiceRow[];
  loading?: boolean;
  /** Services DÉCOCHÉS : non rendus, donc rendus au client. */
  refundedIds: string[];
  onToggle: (id: string) => void;
}

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} DA`;

/**
 * Services obligatoires à la clôture d'une location.
 *
 * Ils ont été facturés d'office à la réservation (nettoyage, plein, etc.).
 * Si le client rend la voiture dans l'état attendu, l'agence n'a pas eu à
 * fournir la prestation : l'agent décoche la ligne et le montant lui est
 * restitué — il est déduit du total dû juste en dessous.
 */
export const MandatoryServicesPanel: React.FC<Props> = ({
  lang, services, loading = false, refundedIds, onToggle,
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const refundTotal = services
    .filter(s => refundedIds.includes(s.id))
    .reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  if (!loading && services.length === 0) return null;

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <header
        className="px-5 py-3.5 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid var(--color-border-soft)', background: 'var(--color-surface-2)' }}
      >
        <span className="p-1.5 rounded-lg" style={{ background: 'var(--color-gold-soft)', color: 'var(--color-gold)' }}>
          <ShieldCheck size={16} />
        </span>
        <div className="min-w-0">
          <h4 className="font-black text-sm uppercase tracking-tight" style={{ color: 'var(--color-text)' }}>
            {T('Services obligatoires', 'الخدمات الإلزامية')}
          </h4>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {T(
              "Décochez un service non fourni : son montant est rendu au client.",
              'ألغِ تحديد خدمة لم تُقدَّم: يُعاد مبلغها للعميل.'
            )}
          </p>
        </div>
      </header>

      <div className="p-5 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin" size={22} style={{ color: 'var(--color-gold)' }} />
          </div>
        ) : (
          services.map(service => {
            const refunded = refundedIds.includes(service.id);
            const kept = !refunded;
            return (
              <motion.button
                key={service.id}
                type="button"
                role="switch"
                aria-checked={kept}
                whileTap={{ scale: 0.99 }}
                onClick={() => onToggle(service.id)}
                className="w-full flex items-center justify-between gap-4 p-4 rounded-xl text-left transition-colors cursor-pointer"
                style={{
                  background: kept ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
                  border: `1px solid ${kept ? 'var(--color-vel-border-gold)' : 'var(--color-border-soft)'}`,
                }}
              >
                <span className="min-w-0">
                  <span
                    className="block font-bold text-sm"
                    style={{
                      color: kept ? 'var(--color-text)' : 'var(--color-text-muted)',
                      textDecoration: kept ? 'none' : 'line-through',
                    }}
                  >
                    {service.name}
                  </span>
                  <span
                    className="block text-[11px] mt-0.5 flex items-center gap-1"
                    style={{ color: kept ? 'var(--color-text-muted)' : 'var(--color-act-success)' }}
                  >
                    {kept
                      ? T('Facturé au client', 'محسوب على العميل')
                      : <><Undo2 size={11} /> {T('Rendu au client', 'يُعاد للعميل')} : {money(service.price)}</>}
                  </span>
                </span>

                <span className="flex items-center gap-3 shrink-0">
                  <span
                    className="font-black text-sm"
                    style={{ color: kept ? 'var(--color-gold)' : 'var(--color-act-success)' }}
                  >
                    {kept ? money(service.price) : `− ${money(service.price)}`}
                  </span>
                  <span
                    className="relative w-12 h-6 rounded-full transition-colors"
                    style={{
                      background: kept ? 'var(--color-gold)' : 'var(--color-surface-3)',
                      border: '1px solid var(--color-border-soft)',
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                      style={{
                        left: kept ? 'calc(100% - 1.375rem)' : '0.125rem',
                        background: kept ? '#0A0A0B' : 'var(--color-text-muted)',
                      }}
                    />
                  </span>
                </span>
              </motion.button>
            );
          })
        )}

        {refundTotal > 0 && (
          <div
            className="mt-3 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
            style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.35)' }}
          >
            <span
              className="font-black text-xs uppercase tracking-tight"
              style={{ color: 'var(--color-act-success)' }}
            >
              {T('Montant rendu au client', 'المبلغ المُعاد للعميل')}
            </span>
            <span className="font-black text-lg" style={{ color: 'var(--color-act-success)' }}>
              − {money(refundTotal)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default MandatoryServicesPanel;
