import React from 'react';
import { motion } from 'motion/react';
import { Check, Plus, X, ShieldCheck, Wrench, Sparkles, Droplets } from 'lucide-react';
import type { Language } from '../../types';

/**
 * Checklist d'inspection — COMPOSANT PARTAGÉ.
 *
 * Rendu identique partout où la checklist apparaît :
 *   • étape « Inspection Départ » de la création de réservation (éditable) ;
 *   • fenêtre « Activer la location »   (lecture seule) ;
 *   • fenêtre « Terminer la location »  (lecture seule + colonne retour).
 *
 * C'est volontairement le SEUL endroit où ce visuel existe : les trois écrans
 * ne peuvent donc pas diverger.
 */

export interface ChecklistItem {
  id: string;
  category: string;
  item_name: string;
}

export interface ChecklistCategory {
  key: string;
  title: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
}

/** Catégories connues, avec leur icône et leur couleur d'accent. */
export const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; fr: string; ar: string }> = {
  securite:    { icon: <ShieldCheck size={16} />, color: 'var(--color-act-delete)',  fr: 'Sécurité',    ar: 'الأمان' },
  equipements: { icon: <Wrench size={16} />,      color: 'var(--color-act-edit)',    fr: 'Équipements', ar: 'المعدات' },
  confort:     { icon: <Sparkles size={16} />,    color: 'var(--color-act-print)',   fr: 'Confort',     ar: 'الراحة' },
  proprete:    { icon: <Droplets size={16} />,    color: 'var(--color-act-payment)', fr: 'Propreté',    ar: 'النظافة' },
};

const metaFor = (key: string) =>
  CATEGORY_META[key] ?? { icon: <Check size={16} />, color: 'var(--color-gold)', fr: key, ar: key };

interface Props {
  lang: Language;
  categories: ChecklistCategory[];
  /** État courant : id de l'item → conforme (true) / non conforme (false). */
  responses: Record<string, boolean>;

  /** Lecture seule : aucune case n'est cliquable (activation / clôture). */
  readOnly?: boolean;

  onToggle?: (itemId: string) => void;
  onRemoveItem?: (itemId: string) => void;

  /** Ajout d'un élément personnalisé (masqué en lecture seule). */
  showAddItem?: boolean;
  newItemValue?: string;
  onNewItemChange?: (v: string) => void;
  onAddItem?: () => void;
  selectedCategory?: string;
  onSelectedCategoryChange?: (v: string) => void;

  /**
   * Seconde série de réponses, affichée à côté de la première.
   * Sert à la clôture : on compare l'état au départ et au retour.
   */
  compareResponses?: Record<string, boolean>;
  compareLabel?: string;
  primaryLabel?: string;
}

export const InspectionChecklist: React.FC<Props> = ({
  lang, categories, responses, readOnly = false,
  onToggle, onRemoveItem,
  showAddItem = false, newItemValue = '', onNewItemChange, onAddItem,
  selectedCategory = 'securite', onSelectedCategoryChange,
  compareResponses, compareLabel, primaryLabel,
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);
  const comparing = Boolean(compareResponses);

  /** Total conforme / total, pour la pastille de progression. */
  const countOf = (items: ChecklistItem[], src: Record<string, boolean>) =>
    items.filter(i => src[i.id]).length;

  return (
    <div className="space-y-5">
      {/* Légende en mode comparaison */}
      {comparing && (
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold uppercase tracking-widest"
             style={{ color: 'var(--color-text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: 'var(--color-act-view)' }} />
            {primaryLabel ?? T('Départ', 'المغادرة')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: 'var(--color-gold)' }} />
            {compareLabel ?? T('Retour', 'العودة')}
          </span>
        </div>
      )}

      {categories.map((category, catIndex) => {
        const meta = metaFor(category.key);
        const ok = countOf(category.items, responses);
        const total = category.items.length;

        return (
          <motion.section
            key={category.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            {/* En-tête de catégorie */}
            <header
              className="px-5 py-3.5 flex items-center justify-between gap-3"
              style={{ borderBottom: '1px solid var(--color-border-soft)', background: 'var(--color-surface-2)' }}
            >
              <h5 className="font-black text-sm uppercase tracking-tight flex items-center gap-2"
                  style={{ color: 'var(--color-text)' }}>
                <span className="p-1.5 rounded-lg" style={{ background: `${meta.color}1F`, color: meta.color }}>
                  {meta.icon}
                </span>
                {category.title}
              </h5>

              {total > 0 && (
                <span
                  className="text-[11px] font-black px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{
                    background: ok === total ? 'rgba(16,185,129,0.15)' : 'var(--color-surface-3)',
                    color: ok === total ? 'var(--color-act-success)' : 'var(--color-text-muted)',
                  }}
                >
                  {ok}/{total}
                </span>
              )}
            </header>

            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {category.items.map(item => {
                  const checked = responses[item.id] === true;
                  const compared = compareResponses?.[item.id] === true;
                  // Un écart entre départ et retour mérite d'être signalé.
                  const changed = comparing && checked !== compared;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all"
                      style={{
                        background: changed
                          ? 'rgba(245,158,11,0.10)'
                          : checked
                            ? 'rgba(16,185,129,0.08)'
                            : 'rgba(239,68,68,0.07)',
                        border: `1.5px solid ${
                          changed
                            ? 'var(--color-act-warning)'
                            : checked
                              ? 'rgba(16,185,129,0.35)'
                              : 'rgba(239,68,68,0.28)'
                        }`,
                      }}
                    >
                      {/* Case départ / principale */}
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => !readOnly && onToggle?.(item.id)}
                        aria-label={item.item_name}
                        aria-pressed={checked}
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
                        }`}
                        style={{
                          background: checked ? 'var(--color-act-success)' : 'transparent',
                          border: `2px solid ${checked ? 'var(--color-act-success)' : 'var(--color-act-delete)'}`,
                        }}
                      >
                        {checked && <Check className="w-3 h-3" color="#fff" strokeWidth={3} />}
                      </button>

                      <span
                        className="font-semibold text-sm flex-1 min-w-0 truncate"
                        style={{ color: checked ? 'var(--color-text)' : 'var(--color-text-soft)' }}
                        title={item.item_name}
                      >
                        {item.item_name}
                      </span>

                      {/* Case retour, en mode comparaison */}
                      {comparing && (
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: compared ? 'var(--color-gold)' : 'transparent',
                            border: `2px solid ${compared ? 'var(--color-gold)' : 'var(--color-act-delete)'}`,
                          }}
                          title={compareLabel ?? T('Retour', 'العودة')}
                        >
                          {compared && <Check className="w-3 h-3" color="#0A0A0B" strokeWidth={3} />}
                        </span>
                      )}

                      {!readOnly && onRemoveItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="p-1 rounded shrink-0 transition-colors opacity-60 hover:opacity-100"
                          style={{ color: 'var(--color-act-delete)' }}
                          title={T('Supprimer cet élément', 'حذف هذا العنصر')}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {category.items.length === 0 && (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--color-text-dim)' }}>
                  {T('Aucun élément dans cette catégorie.', 'لا توجد عناصر في هذه الفئة.')}
                </p>
              )}
            </div>
          </motion.section>
        );
      })}

      {/* Ajout d'un élément personnalisé */}
      {!readOnly && showAddItem && (
        <div
          className="flex flex-wrap gap-2 p-4 rounded-2xl"
          style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
        >
          <select
            value={selectedCategory}
            onChange={e => onSelectedCategoryChange?.(e.target.value)}
            className="input-saas !w-auto !py-2"
          >
            <option value="securite">🛡️ {T('Sécurité', 'الأمان')}</option>
            <option value="equipements">🔧 {T('Équipements', 'المعدات')}</option>
            <option value="confort">✨ {T('Confort', 'الراحة')}</option>
            <option value="proprete">💧 {T('Propreté', 'النظافة')}</option>
          </select>

          <input
            type="text"
            value={newItemValue}
            onChange={e => onNewItemChange?.(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddItem?.(); } }}
            placeholder={T('Ajouter un élément personnalisé…', 'إضافة عنصر مخصص…')}
            className="input-saas flex-1 !py-2 min-w-[200px]"
          />

          <button type="button" onClick={onAddItem} className="btn-saas-primary !px-4 !py-2">
            <Plus className="w-4 h-4" />
            {T('Ajouter', 'إضافة')}
          </button>
        </div>
      )}
    </div>
  );
};

export default InspectionChecklist;
