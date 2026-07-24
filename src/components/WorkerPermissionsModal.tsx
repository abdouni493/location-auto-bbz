import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Check, ShieldAlert, ChevronDown, Shield } from 'lucide-react';
import type { Language, Worker, WorkerPermissions } from '../types';
import { PERMISSION_PAGES } from '../constants/permissions';
import { PermissionsService } from '../services/permissionsService';

interface Props {
  lang: Language;
  worker: Worker;
  onClose: () => void;
  onSaved?: (perms: WorkerPermissions) => void;
}

/**
 * Écran de permissions d'un employé.
 *
 * Deux niveaux :
 *   • cocher une PAGE la fait apparaître dans SA barre latérale ;
 *   • une page cochée déplie ses BOUTONS D'ACTION, cochables un par un.
 *
 * Les actions sensibles (encaissement, suppression, suppression de paiement)
 * sont mises en évidence : ce sont celles qu'un administrateur doit accorder
 * en connaissance de cause.
 */
export const WorkerPermissionsModal: React.FC<Props> = ({ lang, worker, onClose, onSaved }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const [perms, setPerms] = useState<WorkerPermissions>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    PermissionsService.getForWorker(worker.id)
      .then(setPerms)
      .catch(err => {
        console.error('[Permissions] chargement impossible:', err);
        setPerms({});
      })
      .finally(() => setLoading(false));
  }, [worker.id]);

  const pageEnabled = (pageId: string) => Array.isArray(perms[pageId]);

  const togglePage = (pageId: string) => {
    setPerms(prev => {
      const next = { ...prev };
      if (Array.isArray(next[pageId])) {
        delete next[pageId];
      } else {
        // Une page activée démarre avec la seule action « Consulter » si elle
        // existe : l'admin ajoute ensuite ce qu'il veut vraiment accorder.
        const page = PERMISSION_PAGES.find(p => p.id === pageId);
        const hasView = page?.actions.some(a => a.id === 'view');
        next[pageId] = hasView ? ['view'] : [];
        setExpanded(pageId);
      }
      return next;
    });
  };

  const toggleAction = (pageId: string, actionId: string) => {
    setPerms(prev => {
      const current = prev[pageId];
      if (!Array.isArray(current)) return prev;
      const next = current.includes(actionId)
        ? current.filter(a => a !== actionId)
        : [...current, actionId];
      return { ...prev, [pageId]: next };
    });
  };

  const toggleAllActions = (pageId: string) => {
    const page = PERMISSION_PAGES.find(p => p.id === pageId);
    if (!page) return;
    setPerms(prev => {
      const current = prev[pageId] ?? [];
      const all = page.actions.map(a => a.id);
      return { ...prev, [pageId]: current.length === all.length ? [] : all };
    });
  };

  const selectAllPages = () => {
    setPerms(Object.fromEntries(PERMISSION_PAGES.map(p => [p.id, p.actions.map(a => a.id)])));
  };

  const clearAll = () => setPerms({});

  const stats = useMemo(() => {
    const pages = Object.keys(perms).length;
    const actions = Object.values(perms).reduce((s, a) => s + (a?.length ?? 0), 0);
    return { pages, actions };
  }, [perms]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await PermissionsService.setForWorker(worker.id, perms);
      onSaved?.(perms);
      onClose();
    } catch (err: any) {
      console.error('[Permissions] enregistrement impossible:', err);
      setError(err?.message || T("Les permissions n'ont pas pu être enregistrées.", 'تعذر حفظ الصلاحيات.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[75] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lift)' }}
      >
        <header
          className="px-6 py-5 flex items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))', color: '#0A0A0B' }}
        >
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 truncate">
              <Shield size={20} className="shrink-0" />
              {T('Permissions', 'الصلاحيات')}
            </h2>
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-75 mt-0.5 truncate">
              {worker.fullName}
              {worker.roleName && ` — ${worker.roleName}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/10 cursor-pointer shrink-0">
            <X size={22} />
          </button>
        </header>

        {/* Barre de résumé + actions groupées */}
        <div
          className="px-6 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
        >
          <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {stats.pages} {T('page(s)', 'صفحة')} · {stats.actions} {T('action(s)', 'إجراء')}
          </p>
          <div className="flex gap-2">
            <button onClick={selectAllPages} className="btn-saas-outline !px-3 !py-1.5 !text-[11px]">
              {T('Tout cocher', 'تحديد الكل')}
            </button>
            <button onClick={clearAll} className="btn-saas-outline !px-3 !py-1.5 !text-[11px]">
              {T('Tout décocher', 'إلغاء الكل')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 custom-scrollbar" style={{ background: 'var(--color-bg)' }}>
          {loading ? (
            [...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)
          ) : (
            PERMISSION_PAGES.map(page => {
              const enabled = pageEnabled(page.id);
              const granted = perms[page.id] ?? [];
              const isOpen = expanded === page.id;

              return (
                <div
                  key={page.id}
                  className="rounded-xl overflow-hidden transition-colors"
                  style={{
                    background: 'var(--color-surface)',
                    border: `1px solid ${enabled ? 'var(--color-vel-border-gold)' : 'var(--color-border-soft)'}`,
                  }}
                >
                  {/* Ligne page */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={enabled}
                      onClick={() => togglePage(page.id)}
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all cursor-pointer"
                      style={{
                        background: enabled ? 'var(--color-gold)' : 'transparent',
                        border: `2px solid ${enabled ? 'var(--color-gold)' : 'var(--color-border)'}`,
                      }}
                    >
                      {enabled && <Check size={13} color="#0A0A0B" strokeWidth={3} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => (enabled ? setExpanded(isOpen ? null : page.id) : togglePage(page.id))}
                      className="flex-1 flex items-center justify-between gap-3 text-left min-w-0 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">{page.icon}</span>
                        <span className="min-w-0">
                          <span
                            className="block font-bold text-sm truncate"
                            style={{ color: enabled ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                          >
                            {page.label[lang]}
                          </span>
                          {enabled && (
                            <span className="block text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                              {granted.length}/{page.actions.length} {T('actions autorisées', 'إجراء مسموح')}
                            </span>
                          )}
                        </span>
                      </span>

                      {enabled && (
                        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} style={{ color: 'var(--color-text-dim)' }}>
                          <ChevronDown size={16} />
                        </motion.span>
                      )}
                    </button>
                  </div>

                  {/* Actions de la page */}
                  <AnimatePresence initial={false}>
                    {enabled && isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div
                          className="px-4 pb-4 pt-1"
                          style={{ borderTop: '1px dashed var(--color-border-soft)' }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleAllActions(page.id)}
                            className="text-[11px] font-bold underline mb-2.5 cursor-pointer"
                            style={{ color: 'var(--color-gold)' }}
                          >
                            {granted.length === page.actions.length
                              ? T('Tout décocher', 'إلغاء الكل')
                              : T('Tout cocher', 'تحديد الكل')}
                          </button>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {page.actions.map(action => {
                              const on = granted.includes(action.id);
                              return (
                                <button
                                  key={action.id}
                                  type="button"
                                  role="checkbox"
                                  aria-checked={on}
                                  onClick={() => toggleAction(page.id, action.id)}
                                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all cursor-pointer"
                                  style={{
                                    background: on
                                      ? action.sensitive ? 'rgba(239,68,68,0.10)' : 'var(--color-gold-soft)'
                                      : 'var(--color-surface-2)',
                                    border: `1px solid ${
                                      on
                                        ? action.sensitive ? 'rgba(239,68,68,0.35)' : 'var(--color-vel-border-gold)'
                                        : 'var(--color-border-soft)'
                                    }`,
                                  }}
                                >
                                  <span
                                    className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                    style={{
                                      background: on
                                        ? action.sensitive ? 'var(--color-act-delete)' : 'var(--color-gold)'
                                        : 'transparent',
                                      border: `2px solid ${
                                        on
                                          ? action.sensitive ? 'var(--color-act-delete)' : 'var(--color-gold)'
                                          : 'var(--color-border)'
                                      }`,
                                    }}
                                  >
                                    {on && <Check size={10} color={action.sensitive ? '#fff' : '#0A0A0B'} strokeWidth={3} />}
                                  </span>

                                  <span
                                    className="text-xs font-semibold flex-1 min-w-0 truncate"
                                    style={{ color: on ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                                  >
                                    {action.label[lang]}
                                  </span>

                                  {action.sensitive && (
                                    <ShieldAlert
                                      size={13}
                                      className="shrink-0"
                                      style={{ color: 'var(--color-act-delete)' }}
                                      aria-label={T('Action sensible', 'إجراء حساس')}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {page.actions.some(a => a.sensitive) && (
                            <p className="text-[10px] mt-2.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-dim)' }}>
                              <ShieldAlert size={11} style={{ color: 'var(--color-act-delete)' }} />
                              {T(
                                'Les actions marquées touchent aux encaissements ou aux suppressions.',
                                'الإجراءات المعلّمة تتعلق بالتحصيل أو الحذف.'
                              )}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}

          {error && (
            <p className="text-sm font-bold flex items-center gap-2 pt-2" style={{ color: 'var(--color-act-delete)' }}>
              <ShieldAlert size={15} /> {error}
            </p>
          )}
        </div>

        <footer className="p-5 flex gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn-saas-outline flex-1" disabled={saving}>
            {T('Annuler', 'إلغاء')}
          </button>
          <button onClick={save} className="btn-saas-primary flex-1" disabled={saving || loading}>
            {saving
              ? <><Loader2 size={16} className="animate-spin" />{T('Enregistrement…', 'جاري الحفظ…')}</>
              : <><Check size={16} />{T('Enregistrer les permissions', 'حفظ الصلاحيات')}</>}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
};

export default WorkerPermissionsModal;
