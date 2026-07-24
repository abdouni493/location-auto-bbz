import type { Car, ReservationDetails, VehicleExpense } from '../types';

/**
 * Calcul des bénéfices d'un véhicule sur une période.
 *
 * Deux cas :
 *   • voiture PERSONNELLE (`ownerType = 'personal'`) → tout le bénéfice est
 *     pour l'agence ;
 *   • voiture d'un TIERS (`ownerType = 'third_party'`) → l'agence garde
 *     `agencyDailyShare` DZD par jour loué, le reste revient au propriétaire,
 *     duquel on retranche les dépenses du véhicule.
 *
 * Ce module est la SEULE source de vérité : l'écran et le rapport imprimé
 * l'utilisent tous les deux, ils ne peuvent donc pas diverger.
 */

/** Montant réellement encaissé sur une réservation. */
export const paidOf = (r: ReservationDetails): number => {
  const payments = (r.payments || []) as any[];
  if (payments.length > 0) {
    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (total > 0) return total;
  }
  // Pas de lignes de paiement : on déduit depuis le reste dû.
  return Math.max(0, (Number(r.totalPrice) || 0) - (Number(r.remainingPayment) || 0));
};

/** Nombre de jours facturés d'une réservation (au moins 1). */
export const daysOf = (r: ReservationDetails): number =>
  Math.max(1, Number(r.totalDays) || 1);

/** Ligne « location » telle qu'affichée et imprimée. */
export interface BenefitLine {
  id: string;
  clientName: string;
  departureDate: string;
  returnDate: string;
  days: number;
  /** Total facturé au client. */
  total: number;
  /** Montant encaissé. */
  paid: number;
  /** Reste dû par le client. */
  remaining: number;
  /** Part de l'agence sur cette location (0 si voiture personnelle). */
  agencyShare: number;
  /** Part revenant au propriétaire (= encaissé − part agence). */
  ownerShare: number;
  status: string;
}

export interface CarBenefits {
  isThirdParty: boolean;
  ownerName?: string;
  ownerPhone?: string;
  agencyDailyShare: number;

  lines: BenefitLine[];
  expenses: VehicleExpense[];

  /** Nombre de locations retenues (les annulées sont exclues). */
  rentalsCount: number;
  /** Total des jours loués sur la période. */
  totalDays: number;

  totalInvoiced: number;
  totalPaid: number;
  totalRemaining: number;
  totalExpenses: number;

  /** Bénéfice net global (encaissé − dépenses), avant partage. */
  netBenefit: number;

  /** Part totale de l'agence. Vaut `netBenefit` si la voiture est personnelle. */
  agencyBenefit: number;
  /**
   * Part totale du propriétaire, dépenses déduites.
   * Vaut 0 si la voiture appartient à l'agence.
   */
  ownerBenefit: number;
}

/** Une date `YYYY-MM-DD…` tombe-t-elle dans l'intervalle (bornes incluses) ? */
export const inRange = (dateStr: string, startDate: string, endDate: string): boolean => {
  if (!dateStr) return false;
  const d = dateStr.substring(0, 10);
  return (!startDate || d >= startDate) && (!endDate || d <= endDate);
};

export const computeCarBenefits = (
  car: Car,
  reservations: ReservationDetails[],
  expenses: VehicleExpense[]
): CarBenefits => {
  const isThirdParty = car.ownerType === 'third_party';
  const dailyShare = isThirdParty ? Number(car.agencyDailyShare) || 0 : 0;

  // Les réservations annulées ne produisent ni revenu ni part.
  const billable = reservations.filter(r => r.status !== 'cancelled');

  const lines: BenefitLine[] = billable.map(r => {
    const days = daysOf(r);
    const paid = paidOf(r);
    const total = Number(r.totalPrice) || 0;

    // L'agence ne peut pas prélever plus que ce qui a été encaissé.
    const agencyShare = isThirdParty ? Math.min(paid, dailyShare * days) : 0;

    return {
      id: r.id,
      clientName: [r.client?.firstName, r.client?.lastName].filter(Boolean).join(' ').trim()
        || 'Client',
      departureDate: r.step1?.departureDate || '',
      returnDate: r.step1?.returnDate || '',
      days,
      total,
      paid,
      remaining: Number(r.remainingPayment) || 0,
      agencyShare,
      ownerShare: isThirdParty ? Math.max(0, paid - agencyShare) : 0,
      status: r.status,
    };
  });

  const totalInvoiced = lines.reduce((s, l) => s + l.total, 0);
  const totalPaid = lines.reduce((s, l) => s + l.paid, 0);
  const totalDays = lines.reduce((s, l) => s + l.days, 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);

  // Le reste dû ne concerne que les locations encore ouvertes.
  const totalRemaining = reservations
    .filter(r => !['completed', 'cancelled'].includes(r.status))
    .reduce((s, r) => s + (Number(r.remainingPayment) || 0), 0);

  const netBenefit = totalPaid - totalExpenses;
  const agencyBenefit = isThirdParty
    ? lines.reduce((s, l) => s + l.agencyShare, 0)
    : netBenefit;

  // Les dépenses du véhicule sont supportées par son propriétaire.
  const ownerBenefit = isThirdParty
    ? lines.reduce((s, l) => s + l.ownerShare, 0) - totalExpenses
    : 0;

  return {
    isThirdParty,
    ownerName: car.ownerName,
    ownerPhone: car.ownerPhone,
    agencyDailyShare: dailyShare,
    lines,
    expenses,
    rentalsCount: lines.length,
    totalDays,
    totalInvoiced,
    totalPaid,
    totalRemaining,
    totalExpenses,
    netBenefit,
    agencyBenefit,
    ownerBenefit,
  };
};
