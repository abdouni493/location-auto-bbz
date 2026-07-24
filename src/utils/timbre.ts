/**
 * Timbre fiscal (droit de timbre algérien) appliqué au total d'une réservation.
 *
 * Barème demandé :
 *   • total de 300 DA à 30 000 DA        → 1 DA par tranche de 100 DA   (soit 1 %)
 *   • total de 30 001 DA à 100 000 DA    → 1,5 DA par tranche de 100 DA (soit 1,5 %)
 *   • total supérieur à 100 000 DA       → 2 DA par tranche de 100 DA   (soit 2 %)
 *   • total inférieur à 300 DA           → pas de timbre
 *
 * « Par tranche de 100 DA » = toute tranche entamée est due, d'où l'arrondi
 * supérieur. Le même calcul existe côté base dans la fonction `calc_timbre()`
 * pour que l'application et le serveur ne divergent jamais.
 */

export interface TimbreTier {
  /** Borne basse incluse, en DZD. */
  min: number;
  /** Borne haute incluse (null = pas de plafond), en DZD. */
  max: number | null;
  /** DZD dus par tranche de 100 DA. */
  perTranche: number;
  /** Taux équivalent, pour l'affichage. */
  ratePercent: number;
  label: string;
}

export const TIMBRE_TIERS: TimbreTier[] = [
  { min: 300,    max: 30000,  perTranche: 1,   ratePercent: 1,   label: '1 DA par tranche de 100 DA (1 %)' },
  { min: 30001,  max: 100000, perTranche: 1.5, ratePercent: 1.5, label: '1,5 DA par tranche de 100 DA (1,5 %)' },
  { min: 100001, max: null,   perTranche: 2,   ratePercent: 2,   label: '2 DA par tranche de 100 DA (2 %)' },
];

/** Montant minimum à partir duquel un timbre est dû. */
export const TIMBRE_MINIMUM = 300;

/** Palier applicable à un total, ou `null` s'il est sous le seuil. */
export const getTimbreTier = (totalDzd: number): TimbreTier | null => {
  const total = Number(totalDzd) || 0;
  if (total < TIMBRE_MINIMUM) return null;
  return (
    TIMBRE_TIERS.find(t => total >= t.min && (t.max === null || total <= t.max)) ?? null
  );
};

/**
 * Montant du timbre fiscal pour un total donné (en DZD).
 * Retourne 0 sous 300 DA.
 */
export const calcTimbre = (totalDzd: number): number => {
  const total = Number(totalDzd) || 0;
  const tier = getTimbreTier(total);
  if (!tier) return 0;

  // Toute tranche de 100 DA entamée est due.
  const tranches = Math.ceil(total / 100);
  return Math.round(tranches * tier.perTranche * 100) / 100;
};

/** Détail prêt à afficher (récapitulatif de réservation, contrat imprimé). */
export const describeTimbre = (totalDzd: number) => {
  const tier = getTimbreTier(totalDzd);
  const amount = calcTimbre(totalDzd);
  return {
    applicable: tier !== null,
    amount,
    tier,
    /** ex. « 1,5 DA par tranche de 100 DA (1,5 %) » */
    label: tier?.label ?? 'Total inférieur à 300 DA — aucun timbre',
    tranches: tier ? Math.ceil((Number(totalDzd) || 0) / 100) : 0,
  };
};
