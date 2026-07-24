import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Search, Plus, Check, X, Loader2 } from 'lucide-react';
import type { Entreprise, Language } from '../types';
import { EntrepriseService } from '../services/entrepriseService';
import { EntrepriseFormModal } from './EntreprisesPage';

interface Props {
  lang: Language;
  /** Entreprise actuellement rattachée au document. */
  value: Entreprise | null;
  onChange: (e: Entreprise | null) => void;
  /** Affiche l'interrupteur « inclure les informations entreprise ». */
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
}

/**
 * Sélecteur d'entreprise pour l'impression d'un contrat ou d'une facture.
 *
 * Activé, il permet de RECHERCHER une entreprise par son nom et de la
 * sélectionner ; si elle n'existe pas encore, elle se crée sans quitter la
 * fenêtre d'impression (le formulaire est celui de la page Entreprises, pour
 * que les champs légaux restent identiques).
 */
export const EntreprisePicker: React.FC<Props> = ({
  lang, value, onChange, enabled, onEnabledChange,
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entreprise[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Recherche différée : on n'interroge pas la base à chaque frappe.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(() => {
      EntrepriseService.search(query)
        .then(list => { if (!cancelled) setResults(list); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, enabled]);

  // Ferme la liste au clic extérieur.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Interrupteur */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onEnabledChange(!enabled)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer text-left"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span
            className="p-2 rounded-lg shrink-0"
            style={{
              background: enabled ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
              color: enabled ? 'var(--color-gold)' : 'var(--color-text-muted)',
            }}
          >
            <Building2 size={16} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-sm" style={{ color: 'var(--color-text)' }}>
              {T('Informations entreprise', 'معلومات الشركة')}
            </span>
            <span className="block text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
              {enabled && value
                ? value.name
                : T('Ajouter les mentions légales au document', 'إضافة البيانات القانونية للوثيقة')}
            </span>
          </span>
        </span>

        <span
          className="relative w-12 h-6 rounded-full shrink-0 transition-colors"
          style={{
            background: enabled ? 'var(--color-gold)' : 'var(--color-surface-3)',
            border: '1px solid var(--color-border-soft)',
          }}
        >
          <motion.span
            layout
            transition={{ type: 'spring', stiffness: 520, damping: 32 }}
            className="absolute top-0.5 w-5 h-5 rounded-full"
            style={{
              left: enabled ? 'calc(100% - 1.375rem)' : '0.125rem',
              background: enabled ? '#0A0A0B' : 'var(--color-text-muted)',
            }}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px dashed var(--color-border-soft)' }}>
              {/* Entreprise sélectionnée */}
              {value ? (
                <div
                  className="p-3 rounded-xl"
                  style={{ background: 'var(--color-gold-soft)', border: '1px solid var(--color-vel-border-gold)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-sm truncate" style={{ color: 'var(--color-gold)' }}>
                        {value.name}
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5 text-[11px] font-mono"
                           style={{ color: 'var(--color-text-muted)' }}>
                        {value.rc  && <span>RC : {value.rc}</span>}
                        {value.art && <span>ART : {value.art}</span>}
                        {value.nis && <span>NIS : {value.nis}</span>}
                        {value.nif && <span>NIF : {value.nif}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { onChange(null); setQuery(''); }}
                      className="btn-icon btn-icon-delete shrink-0 !w-8 !h-8"
                      title={T('Retirer', 'إزالة')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Recherche */}
                  <div ref={boxRef} className="relative">
                    <Search
                      size={15}
                      className="absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                      value={query}
                      onChange={e => { setQuery(e.target.value); setOpen(true); }}
                      onFocus={() => setOpen(true)}
                      className="input-saas ps-9"
                      placeholder={T("Rechercher une entreprise par nom…", 'ابحث عن شركة بالاسم…')}
                    />
                    {searching && (
                      <Loader2
                        size={15}
                        className="absolute end-3 top-1/2 -translate-y-1/2 animate-spin"
                        style={{ color: 'var(--color-gold)' }}
                      />
                    )}

                    <AnimatePresence>
                      {open && (
                        <motion.ul
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.16 }}
                          className="absolute inset-x-0 mt-1.5 rounded-xl overflow-hidden z-50 max-h-56 overflow-y-auto custom-scrollbar"
                          style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-lift)',
                          }}
                        >
                          {results.length === 0 && !searching ? (
                            <li className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-dim)' }}>
                              {T('Aucune entreprise trouvée.', 'لم يتم العثور على شركة.')}
                            </li>
                          ) : (
                            results.map(e => (
                              <li key={e.id}>
                                <button
                                  type="button"
                                  onClick={() => { onChange(e); setOpen(false); }}
                                  className="w-full text-start px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]"
                                >
                                  <span
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                                    style={{ background: 'var(--color-gold-soft)', color: 'var(--color-gold)' }}
                                  >
                                    {e.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-bold truncate" style={{ color: 'var(--color-text)' }}>
                                      {e.name}
                                    </span>
                                    {(e.rc || e.nif) && (
                                      <span className="block text-[10px] font-mono truncate" style={{ color: 'var(--color-text-dim)' }}>
                                        {[e.rc && `RC ${e.rc}`, e.nif && `NIF ${e.nif}`].filter(Boolean).join(' · ')}
                                      </span>
                                    )}
                                  </span>
                                  <Check size={14} style={{ color: 'var(--color-gold)' }} className="opacity-0" />
                                </button>
                              </li>
                            ))
                          )}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Création à la volée */}
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="btn-saas-outline w-full !py-2 !text-xs"
                  >
                    <Plus size={14} />
                    {T('Créer une nouvelle entreprise', 'إنشاء شركة جديدة')}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulaire de création — même composant que la page Entreprises */}
      <AnimatePresence>
        {createOpen && (
          <EntrepriseFormModal
            lang={lang}
            entreprise={null}
            initialName={query}
            onClose={() => setCreateOpen(false)}
            onSaved={saved => {
              onChange(saved);
              setCreateOpen(false);
              setOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default EntreprisePicker;
