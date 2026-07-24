import React from 'react';
import { Plane, FileText, ExternalLink } from 'lucide-react';
import type { Language } from '../types';

interface Props {
  /** Réservation mappée (camelCase) ou ligne brute (snake_case). */
  reservation: Record<string, any>;
  lang: Language;
  className?: string;
}

const fmtDate = (d?: string) => {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

/**
 * Informations de vol saisies par le client sur le site public
 * (numéro, date et heure d'arrivée, justificatif du billet).
 *
 * Ne rend rien si aucune information de vol n'a été fournie — les
 * réservations créées par l'agence n'en ont pas.
 */
export const FlightInfoPanel: React.FC<Props> = ({ reservation, lang, className = '' }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const number = reservation.flightNumber ?? reservation.flight_number;
  const date = reservation.flightDate ?? reservation.flight_date;
  const time = reservation.flightTime ?? reservation.flight_time;
  const ticket = reservation.flightTicketImage ?? reservation.flight_ticket_image;

  if (!number && !date && !ticket) return null;

  const isPdf = typeof ticket === 'string' && ticket.toLowerCase().includes('.pdf');

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }}
    >
      <div className="px-4 py-3">
        <p
          className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Plane size={12} /> {T('Informations de vol', 'معلومات الرحلة')}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {number && (
            <div>
              <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                {T('Numéro de vol', 'رقم الرحلة')}
              </p>
              <p className="font-black text-sm font-mono tracking-wide" style={{ color: 'var(--color-gold)' }}>
                {number}
              </p>
            </div>
          )}
          {date && (
            <div>
              <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                {T("Date d'arrivée", 'تاريخ الوصول')}
              </p>
              <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{fmtDate(date)}</p>
            </div>
          )}
          {time && (
            <div>
              <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                {T("Heure d'arrivée", 'وقت الوصول')}
              </p>
              <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                {String(time).substring(0, 5)}
              </p>
            </div>
          )}
        </div>

        {ticket && (
          <a
            href={ticket}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{
              background: 'var(--color-gold-soft)',
              border: '1px solid var(--color-vel-border-gold)',
              color: 'var(--color-gold)',
            }}
          >
            {isPdf ? <FileText size={14} /> : <ExternalLink size={14} />}
            {T('Voir le justificatif du billet', 'عرض إثبات التذكرة')}
          </a>
        )}

        {/* Aperçu direct quand c'est une image */}
        {ticket && !isPdf && (
          <img
            src={ticket}
            alt={T('Justificatif du billet', 'إثبات التذكرة')}
            className="mt-3 w-full max-h-48 object-contain rounded-lg cursor-pointer"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-soft)' }}
            onClick={() => window.open(ticket, '_blank')}
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
};

export default FlightInfoPanel;
