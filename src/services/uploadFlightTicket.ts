import { supabase } from '../supabase';

export interface FlightTicketUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Téléverse le justificatif de billet d'avion d'un client dans le bucket
 * public « flight-tickets ».
 *
 * Contrairement aux autres uploads de l'app, celui-ci est lancé par un
 * VISITEUR ANONYME depuis le wizard du site public : la policy
 * `flight_tickets_anon_insert` autorise donc le rôle `anon` à écrire dans ce
 * bucket (et uniquement celui-là).
 *
 * Le PDF est accepté en plus des images : beaucoup de compagnies délivrent le
 * billet électronique sous cette forme.
 */
const MAX_SIZE = 8 * 1024 * 1024; // 8 Mo
const ACCEPTED = ['image/', 'application/pdf'];

export async function uploadFlightTicket(file: File): Promise<FlightTicketUploadResult> {
  try {
    if (!ACCEPTED.some(t => file.type.startsWith(t))) {
      return { success: false, error: 'Le justificatif doit être une image ou un PDF.' };
    }
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'Le fichier ne doit pas dépasser 8 Mo.' };
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    const { error } = await supabase.storage
      .from('flight-tickets')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) {
      console.error('[uploadFlightTicket] échec:', error);
      // Message explicite quand la migration n'a pas encore créé le bucket.
      if (error.message?.toLowerCase().includes('bucket')) {
        return {
          success: false,
          error: "Le stockage des billets n'est pas encore configuré. Exécutez migration_2026_07.sql.",
        };
      }
      return { success: false, error: error.message };
    }

    const { data } = supabase.storage.from('flight-tickets').getPublicUrl(path);
    return { success: true, url: data.publicUrl };
  } catch (err: any) {
    console.error('[uploadFlightTicket] exception:', err);
    return { success: false, error: err?.message || "Erreur lors de l'envoi du justificatif." };
  }
}

/** Supprime un justificatif depuis son URL publique. */
export async function deleteFlightTicket(url: string): Promise<boolean> {
  try {
    const path = url.split('/flight-tickets/')[1];
    if (!path) return false;
    const { error } = await supabase.storage.from('flight-tickets').remove([path]);
    return !error;
  } catch {
    return false;
  }
}
