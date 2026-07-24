import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Fuel, Gauge, CheckCircle2 } from 'lucide-react';
import type { Language, MileagePolicy } from '../../types';
import { FUEL_LABELS, type FuelLevel } from '../../services/settingsService';

interface Props {
  lang: Language;
  policy: MileagePolicy;
  /** Limite en km applicable à cette location (null = illimité). */
  mileageLimit: number | null;
  departureMileage?: number;
  returnMileage: number | null;
  departureFuel?: string;
  returnFuel: string;
  /** Nombre de crans de carburant manquants. */
  missingFuelLevels: number;
  /** Frais saisis, pour signaler qu'ils sont à zéro alors qu'un écart existe. */
  mileageFee: number;
  fuelFee: number;
}

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} DA`;

/**
 * Alertes de clôture : dépassement kilométrique et carburant manquant.
 *
 * Ne s'affiche que lorsqu'il y a réellement quelque chose à signaler — sinon
 * une simple confirmation verte, pour que l'agent sache que le contrôle a bien
 * été fait.
 */
export const ReturnAlerts: React.FC<Props> = ({
  lang, policy, mileageLimit, departureMileage, returnMileage,
  departureFuel, returnFuel, missingFuelLevels, mileageFee, fuelFee,
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  // Rien à comparer tant que le kilométrage de retour n'est pas saisi.
  const hasReturn = returnMileage !== null && Number.isFinite(returnMileage);
  const distance = hasReturn && departureMileage != null
    ? Math.max(0, (returnMileage as number) - departureMileage)
    : null;

  const overLimit = mileageLimit != null && distance != null && distance > mileageLimit;
  const excessKm = overLimit ? (distance as number) - (mileageLimit as number) : 0;
  const suggestedMileageFee = excessKm * (policy.feePerExtraKm || 0);

  const fuelShort = missingFuelLevels > 0;
  const suggestedFuelFee = missingFuelLevels * (policy.fuelFeePerLevel || 0);

  const nothingToReport = hasReturn && !overLimit && !fuelShort;

  const alert = (
    key: string,
    icon: React.ReactNode,
    title: string,
    body: React.ReactNode,
    suggested: number,
    current: number
  ) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div
        className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.32)' }}
      >
        <span className="p-2 rounded-lg shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-act-delete)' }}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm" style={{ color: 'var(--color-act-delete)' }}>{title}</p>
          <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-soft)' }}>{body}</div>

          <p className="text-xs mt-2 font-bold" style={{ color: 'var(--color-act-warning)' }}>
            {T('Frais suggérés', 'الرسوم المقترحة')} : {money(suggested)}
            {current === 0 && suggested > 0 && (
              <span className="font-normal" style={{ color: 'var(--color-text-dim)' }}>
                {' — '}{T('à saisir ci-dessous', 'يُدخل أدناه')}
              </span>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {overLimit && alert(
          'mileage',
          <Gauge size={16} />,
          T('Limite kilométrique dépassée', 'تم تجاوز حد المسافة'),
          <>
            {T('Distance parcourue', 'المسافة المقطوعة')} :{' '}
            <strong>{distance?.toLocaleString('fr-FR')} km</strong>
            {' · '}
            {T('Limite', 'الحد')} : <strong>{mileageLimit?.toLocaleString('fr-FR')} km</strong>
            <br />
            {T('Dépassement', 'التجاوز')} :{' '}
            <strong style={{ color: 'var(--color-act-delete)' }}>
              {excessKm.toLocaleString('fr-FR')} km
            </strong>
            {' × '}{money(policy.feePerExtraKm)}/km
          </>,
          suggestedMileageFee,
          mileageFee
        )}

        {fuelShort && alert(
          'fuel',
          <Fuel size={16} />,
          T('Carburant manquant au retour', 'وقود ناقص عند العودة'),
          <>
            {T('Au départ', 'عند المغادرة')} :{' '}
            <strong>{FUEL_LABELS[departureFuel as FuelLevel] ?? departureFuel ?? '—'}</strong>
            {' · '}
            {T('Au retour', 'عند العودة')} :{' '}
            <strong style={{ color: 'var(--color-act-delete)' }}>
              {FUEL_LABELS[returnFuel as FuelLevel] ?? returnFuel}
            </strong>
            <br />
            {missingFuelLevels} {T('cran(s) manquant(s)', 'درجة ناقصة')}
            {' × '}{money(policy.fuelFeePerLevel)}
          </>,
          suggestedFuelFee,
          fuelFee
        )}

        {nothingToReport && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.30)' }}
            >
              <CheckCircle2 size={18} style={{ color: 'var(--color-act-success)' }} />
              <div>
                <p className="font-black text-sm" style={{ color: 'var(--color-act-success)' }}>
                  {T('Retour conforme', 'عودة مطابقة')}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {distance != null && (
                    <>{distance.toLocaleString('fr-FR')} km {T('parcourus', 'مقطوعة')}
                      {mileageLimit != null && ` / ${mileageLimit.toLocaleString('fr-FR')} km`}
                      {' · '}</>
                  )}
                  {T('carburant au niveau attendu', 'الوقود بالمستوى المتوقع')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReturnAlerts;

/** Frais suggérés, réutilisables par l'appelant pour pré-remplir les champs. */
export const computeSuggestedFees = (
  policy: MileagePolicy,
  mileageLimit: number | null,
  departureMileage: number | undefined,
  returnMileage: number | null,
  missingFuelLevels: number
): { mileageFee: number; fuelFee: number; excessKm: number } => {
  const distance =
    returnMileage != null && departureMileage != null
      ? Math.max(0, returnMileage - departureMileage)
      : 0;

  const excessKm = mileageLimit != null && distance > mileageLimit ? distance - mileageLimit : 0;

  return {
    excessKm,
    mileageFee: Math.round(excessKm * (policy.feePerExtraKm || 0)),
    fuelFee: Math.round(missingFuelLevels * (policy.fuelFeePerLevel || 0)),
  };
};
