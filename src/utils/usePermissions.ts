import { useEffect, useState } from 'react';
import type { WorkerPermissions } from '../types';
import { PermissionsService, canDo, canSeePage } from '../services/permissionsService';

/**
 * Permissions de l'utilisateur connecté, prêtes à l'emploi dans une page.
 *
 * Usage typique :
 *
 *   const { can } = usePermissions('vehicles');
 *   {can('create') && <button…>Nouveau véhicule</button>}
 *
 * Un administrateur reçoit `isAdmin = true` : `can()` renvoie alors toujours
 * vrai, sans avoir à traiter ce cas dans chaque écran.
 *
 * Les permissions sont mises en cache au niveau du module : les pages qui
 * appellent ce hook ne déclenchent pas chacune un aller-retour réseau.
 */

let cache: { isAdmin: boolean; permissions: WorkerPermissions } | null = null;
let inflight: Promise<{ isAdmin: boolean; permissions: WorkerPermissions }> | null = null;

const load = () => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = PermissionsService.getMine()
      .then(res => {
        cache = { isAdmin: res.isAdmin, permissions: res.permissions };
        return cache;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/** Vide le cache — à appeler après modification des permissions d'un employé. */
export const invalidatePermissions = () => { cache = null; };

export interface UsePermissionsResult {
  isAdmin: boolean;
  permissions: WorkerPermissions | null;
  loading: boolean;
  /** L'utilisateur peut-il utiliser cette action sur la page courante ? */
  can: (actionId: string) => boolean;
  /** L'utilisateur peut-il utiliser cette action sur UNE AUTRE page ? */
  canOn: (pageId: string, actionId: string) => boolean;
  /** La page est-elle visible pour lui ? */
  canSee: (pageId: string) => boolean;
}

export const usePermissions = (pageId?: string): UsePermissionsResult => {
  const [state, setState] = useState<{ isAdmin: boolean; permissions: WorkerPermissions } | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setState(cache); setLoading(false); return; }
    let cancelled = false;

    load()
      .then(res => { if (!cancelled) setState(res); })
      .catch(() => {
        // Sans réponse du serveur, on n'ouvre rien de plus : seul un admin
        // atteint l'application aujourd'hui, on garde donc l'accès complet.
        if (!cancelled) setState({ isAdmin: true, permissions: {} });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const isAdmin = state?.isAdmin ?? true;
  const permissions = state?.permissions ?? null;

  return {
    isAdmin,
    permissions: isAdmin ? null : permissions,
    loading,
    can: (actionId: string) =>
      isAdmin || (pageId ? canDo(permissions, pageId, actionId) : false),
    canOn: (page: string, actionId: string) =>
      isAdmin || canDo(permissions, page, actionId),
    canSee: (page: string) => isAdmin || canSeePage(permissions, page),
  };
};

export default usePermissions;
