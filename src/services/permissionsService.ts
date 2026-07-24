import { supabase } from '../supabase';
import type { WorkerPermissions, WorkerRole } from '../types';
import { FULL_PERMISSIONS, PERMISSION_PAGES } from '../constants/permissions';

/**
 * Rôles et permissions des employés.
 *
 * Modèle : `worker_permissions` contient une ligne par (employé, page).
 *   • la ligne existe          → la page apparaît dans SA sidebar ;
 *   • `actions` liste les ids  → seuls ces boutons lui sont rendus.
 *
 * Un administrateur n'a aucune ligne : il reçoit `FULL_PERMISSIONS()`.
 */

// ─── Rôles ─────────────────────────────────────────────────────────────────

export const RoleService = {
  async getAll(): Promise<WorkerRole[]> {
    const { data, error } = await supabase
      .from('worker_roles')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
    }));
  },

  async create(name: string): Promise<WorkerRole> {
    const clean = name.trim();
    if (!clean) throw new Error('Le nom du rôle est obligatoire.');

    const { data, error } = await supabase
      .from('worker_roles')
      .insert([{ name: clean }])
      .select()
      .single();

    if (error) {
      // 23505 = violation d'unicité : le rôle existe déjà, on le renvoie.
      if ((error as any).code === '23505') {
        const { data: existing } = await supabase
          .from('worker_roles')
          .select('*')
          .ilike('name', clean)
          .single();
        if (existing) {
          return { id: existing.id, name: existing.name, createdAt: existing.created_at };
        }
      }
      throw error;
    }

    return { id: data.id, name: data.name, createdAt: data.created_at };
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('worker_roles').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─── Permissions ───────────────────────────────────────────────────────────

export const PermissionsService = {
  /** Permissions d'UN employé, telles qu'enregistrées. */
  async getForWorker(workerId: string): Promise<WorkerPermissions> {
    const { data, error } = await supabase
      .from('worker_permissions')
      .select('page_id, actions')
      .eq('worker_id', workerId);

    if (error) throw error;

    const out: WorkerPermissions = {};
    (data || []).forEach((row: any) => {
      out[row.page_id] = Array.isArray(row.actions) ? row.actions : [];
    });
    return out;
  },

  /** Remplace intégralement les permissions d'un employé. */
  async setForWorker(workerId: string, perms: WorkerPermissions): Promise<void> {
    // La RPC fait le delete + insert dans une seule transaction.
    const { data, error } = await supabase.rpc('set_worker_permissions', {
      p_worker_id: workerId,
      p_perms: perms,
    });

    if (!error && data?.success) return;

    // Repli si la RPC n'existe pas encore (migration non appliquée).
    if (error) console.warn('[Permissions] RPC indisponible, écriture directe', error);

    const { error: delErr } = await supabase
      .from('worker_permissions')
      .delete()
      .eq('worker_id', workerId);
    if (delErr) throw delErr;

    const rows = Object.entries(perms).map(([pageId, actions]) => ({
      worker_id: workerId,
      page_id: pageId,
      actions,
    }));
    if (rows.length === 0) return;

    const { error: insErr } = await supabase.from('worker_permissions').insert(rows);
    if (insErr) throw insErr;
  },

  /**
   * Permissions de l'utilisateur CONNECTÉ.
   * Un admin reçoit toutes les permissions ; un employé, les siennes.
   */
  async getMine(): Promise<{ isAdmin: boolean; workerId?: string; permissions: WorkerPermissions }> {
    try {
      const { data, error } = await supabase.rpc('get_my_permissions');
      if (error) throw error;

      if (data?.isAdmin) {
        return { isAdmin: true, permissions: FULL_PERMISSIONS() };
      }
      return {
        isAdmin: false,
        workerId: data?.workerId ?? undefined,
        permissions: (data?.permissions ?? {}) as WorkerPermissions,
      };
    } catch (err) {
      console.warn('[Permissions] get_my_permissions indisponible', err);
      // Sans la RPC on ne peut pas décider : on n'accorde rien de plus qu'un
      // repli admin, car seul un admin peut atteindre l'app aujourd'hui.
      return { isAdmin: true, permissions: FULL_PERMISSIONS() };
    }
  },
};

// ─── Helpers de rendu ──────────────────────────────────────────────────────

/** L'employé voit-il cette page dans sa sidebar ? */
export const canSeePage = (perms: WorkerPermissions | null, pageId: string): boolean => {
  if (!perms) return false;
  return Array.isArray(perms[pageId]);
};

/** L'employé a-t-il le droit d'utiliser ce bouton ? */
export const canDo = (
  perms: WorkerPermissions | null,
  pageId: string,
  actionId: string
): boolean => {
  if (!perms) return false;
  const actions = perms[pageId];
  return Array.isArray(actions) && actions.includes(actionId);
};

/** Permissions minimales d'un employé fraîchement créé : aucune. */
export const EMPTY_PERMISSIONS: WorkerPermissions = {};

/** Toutes les pages cochées avec toutes leurs actions (bouton « tout cocher »). */
export const ALL_PERMISSIONS = (): WorkerPermissions => FULL_PERMISSIONS();

/** Les ids de page connus du catalogue. */
export const PERMISSION_PAGE_IDS = PERMISSION_PAGES.map(p => p.id);
