import { supabase } from '../supabase';
import type { Entreprise, EntrepriseStats, ReservationDetails } from '../types';

/**
 * Entreprises clientes (table `entreprises`).
 *
 * Sert à deux endroits :
 *   • la page « Entreprises » (cartes, CRUD, historique des locations) ;
 *   • l'impression du contrat et de la facture, quand l'option « informations
 *     entreprise » est activée — l'utilisateur cherche l'entreprise par nom,
 *     ou la crée à la volée depuis la fenêtre d'impression.
 */

const mapRow = (row: any): Entreprise => ({
  id: row.id,
  name: row.name ?? '',
  rc: row.rc ?? undefined,
  art: row.art ?? undefined,
  nis: row.nis ?? undefined,
  nif: row.nif ?? undefined,
  phone: row.phone ?? undefined,
  email: row.email ?? undefined,
  address: row.address ?? undefined,
  note: row.note ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? undefined,
});

const toRow = (e: Partial<Entreprise>) => ({
  name: e.name,
  rc: e.rc || null,
  art: e.art || null,
  nis: e.nis || null,
  nif: e.nif || null,
  phone: e.phone || null,
  email: e.email || null,
  address: e.address || null,
  note: e.note || null,
});

export const EntrepriseService = {
  async getAll(): Promise<Entreprise[]> {
    const { data, error } = await supabase
      .from('entreprises')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapRow);
  },

  async getById(id: string): Promise<Entreprise | null> {
    const { data, error } = await supabase
      .from('entreprises')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRow(data) : null;
  },

  /** Recherche par nom (utilisée par l'autocomplétion de l'impression). */
  async search(query: string, limit = 20): Promise<Entreprise[]> {
    const q = query.trim();
    if (!q) return this.getAll();

    const { data, error } = await supabase
      .from('entreprises')
      .select('*')
      .ilike('name', `%${q}%`)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapRow);
  },

  async create(entreprise: Partial<Entreprise>): Promise<Entreprise> {
    if (!entreprise.name?.trim()) throw new Error('Le nom de l\'entreprise est obligatoire.');

    const { data, error } = await supabase
      .from('entreprises')
      .insert([toRow(entreprise)])
      .select()
      .single();

    if (error) throw error;
    return mapRow(data);
  },

  async update(id: string, updates: Partial<Entreprise>): Promise<Entreprise> {
    const { data, error } = await supabase
      .from('entreprises')
      .update({ ...toRow(updates), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapRow(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('entreprises').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Historique des locations d'une entreprise + totaux
   * (total facturé, total encaissé, reste à payer).
   */
  async getHistory(entrepriseId: string): Promise<{
    reservations: any[];
    stats: EntrepriseStats;
  }> {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        client:clients(*),
        car:cars(*),
        payments(*)
      `)
      .eq('entreprise_id', entrepriseId)
      .order('departure_date', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    // Les annulées ne comptent ni au chiffre d'affaires ni au reste dû.
    const billable = rows.filter((r: any) => r.status !== 'cancelled');

    const total = billable.reduce((s: number, r: any) => s + (Number(r.total_price) || 0), 0);
    const totalPaid = billable.reduce((s: number, r: any) => {
      const fromPayments = (r.payments || []).reduce(
        (ps: number, p: any) => ps + (Number(p.amount) || 0), 0
      );
      // Certaines réservations n'ont pas de lignes de paiement : on retombe
      // sur l'acompte enregistré directement sur la réservation.
      return s + (fromPayments > 0 ? fromPayments : Number(r.advance_payment) || 0);
    }, 0);

    return {
      reservations: rows,
      stats: {
        reservationsCount: billable.length,
        total,
        totalPaid,
        totalRemaining: Math.max(0, total - totalPaid),
      },
    };
  },
};
