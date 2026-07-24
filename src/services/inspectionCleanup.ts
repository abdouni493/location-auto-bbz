import { supabase } from '../supabase';

/**
 * Suppression DÉFINITIVE des photos d'inspection d'une réservation.
 *
 * Appelée à la clôture d'une location : une fois le véhicule rendu et le
 * dossier soldé, les photos n'ont plus de raison d'être conservées (volume de
 * stockage + données personnelles).
 *
 * Deux étapes, dans cet ordre :
 *   1. suppression des FICHIERS dans le bucket `inspection` ;
 *   2. remise à NULL des URL dans `vehicle_inspections` (RPC
 *      `purge_reservation_inspection_images`, qui renvoie la liste des URL
 *      qu'elle vient d'effacer).
 *
 * On récupère d'abord les URL, puis on efface les fichiers, puis la base :
 * si le nettoyage du stockage échoue, les URL restent en base et l'opération
 * pourra être rejouée — on ne perd pas la trace des fichiers à supprimer.
 */

const BUCKET = 'inspection';

/** Extrait le chemin interne au bucket depuis une URL publique Supabase. */
const pathFromPublicUrl = (url: string): string | null => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(url.substring(idx + marker.length));
  // URL déjà relative (ancien format) : on la prend telle quelle.
  if (!url.startsWith('http')) return url.replace(/^\/+/, '');
  return null;
};

export interface PurgeResult {
  success: boolean;
  filesDeleted: number;
  error?: string;
}

/** Toutes les URL de photos rattachées aux inspections d'une réservation. */
export async function collectInspectionImageUrls(reservationId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select('exterior_front_photo, exterior_rear_photo, interior_photo, other_photos')
    .eq('reservation_id', reservationId);

  if (error) {
    console.warn('[inspectionCleanup] lecture des inspections impossible:', error);
    return [];
  }

  const urls: string[] = [];
  (data || []).forEach(row => {
    [row.exterior_front_photo, row.exterior_rear_photo, row.interior_photo].forEach(u => {
      if (u) urls.push(u);
    });
    (row.other_photos || []).forEach((u: string) => u && urls.push(u));
  });

  // Un même fichier peut être référencé deux fois (départ + retour).
  return [...new Set(urls)];
}

/**
 * Supprime définitivement les photos d'inspection d'une réservation :
 * fichiers du bucket ET références en base.
 */
export async function purgeInspectionImages(reservationId: string): Promise<PurgeResult> {
  try {
    const urls = await collectInspectionImageUrls(reservationId);

    // 1) Fichiers du stockage
    let filesDeleted = 0;
    const paths = urls.map(pathFromPublicUrl).filter((p): p is string => Boolean(p));

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
      if (storageError) {
        // On continue quand même : purger la base reste préférable à ne rien faire.
        console.warn('[inspectionCleanup] suppression des fichiers partielle:', storageError);
      } else {
        filesDeleted = paths.length;
      }
    }

    // 2) Références en base (RPC transactionnelle)
    const { error: rpcError } = await supabase.rpc('purge_reservation_inspection_images', {
      p_reservation_id: reservationId,
    });

    if (rpcError) {
      // Repli si la migration n'a pas encore été appliquée.
      console.warn('[inspectionCleanup] RPC indisponible, mise à jour directe:', rpcError);
      const { error: updateError } = await supabase
        .from('vehicle_inspections')
        .update({
          exterior_front_photo: null,
          exterior_rear_photo: null,
          interior_photo: null,
          other_photos: [],
        })
        .eq('reservation_id', reservationId);

      if (updateError) {
        return { success: false, filesDeleted, error: updateError.message };
      }
    }

    console.log(`[inspectionCleanup] ${filesDeleted}/${paths.length} fichier(s) supprimé(s) pour la réservation ${reservationId}`);
    return { success: true, filesDeleted };
  } catch (err: any) {
    console.error('[inspectionCleanup] échec de la purge:', err);
    return { success: false, filesDeleted: 0, error: err?.message || 'Erreur inconnue' };
  }
}
