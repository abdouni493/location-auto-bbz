import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronDown, Coins } from 'lucide-react';
import { useCurrency, type CurrencySelection } from './CurrencyContext';
import { CURRENCY_META } from '../../utils/currency';
import type { Language } from '../../types';

interface CurrencySwitcherProps {
  lang: Language;
  /** `nav` : compact, pour la barre de navigation. `bar` : rangée de pastilles. */
  variant?: 'nav' | 'bar';
  className?: string;
}

/**
 * Sélecteur de devise du site public.
 *
 * Présent à deux endroits :
 *   • dans la barre de navigation (variante `nav`) ;
 *   • en haut de la page des offres (variante `bar`), pour filtrer les prix
 *     affichés sur les cartes.
 *
 * L'option « Toutes » affiche chaque prix dans toutes les devises disponibles.
 */
export const CurrencySwitcher: React.FC<CurrencySwitcherProps> = ({
  lang, variant = 'nav', className = '',
}) => {
  const { currencies, selected, setSelected } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  // Ferme le menu au clic extérieur / à Échap.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Une seule devise activée : le sélecteur n'a aucun intérêt.
  if (currencies.length <= 1) return null;

  const options: { value: CurrencySelection; label: string; sub: string; flag: string }[] = [
    {
      value: 'ALL',
      label: T('Toutes les devises', 'كل العملات'),
      sub: T('Afficher tous les prix', 'عرض كل الأسعار'),
      flag: '🌍',
    },
    ...currencies.map(c => ({
      value: c.code as CurrencySelection,
      label: `${c.code} — ${c.symbol}`,
      sub: c.isBase
        ? T('Devise de référence', 'العملة المرجعية')
        : `1 ${c.symbol} = ${c.rateToDzd} DA`,
      flag: CURRENCY_META[c.code]?.flag ?? '💱',
    })),
  ];

  const current = options.find(o => o.value === selected) ?? options[0];

  // ── Variante « rangée de pastilles » (page des offres) ──────────────────
  if (variant === 'bar') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span
          className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 mr-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Coins size={13} /> {T('Devise', 'العملة')}
        </span>

        {options.map(opt => {
          const isActive = selected === opt.value;
          return (
            <motion.button
              key={opt.value}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelected(opt.value)}
              className="relative px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              style={{
                background: isActive ? 'var(--color-gold-soft)' : 'var(--color-surface)',
                border: `1px solid ${isActive ? 'var(--color-gold)' : 'var(--color-border-soft)'}`,
                color: isActive ? 'var(--color-gold)' : 'var(--color-text-muted)',
              }}
              title={opt.sub}
            >
              <span>{opt.flag}</span>
              {opt.value === 'ALL' ? T('Toutes', 'الكل') : opt.value}
            </motion.button>
          );
        })}
      </div>
    );
  }

  // ── Variante « menu déroulant » (barre de navigation) ───────────────────
  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-gold)',
          border: '1px solid var(--color-vel-border-gold)',
          background: 'var(--color-gold-soft)',
        }}
      >
        <span>{current.flag}</span>
        <span>{selected === 'ALL' ? T('Devises', 'العملات') : selected}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute end-0 mt-2 w-60 rounded-xl overflow-hidden z-50 py-1"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lift)',
            }}
          >
            {options.map(opt => {
              const isActive = selected === opt.value;
              return (
                <li key={opt.value}>
                  <button
                    role="option"
                    aria-selected={isActive}
                    onClick={() => { setSelected(opt.value); setOpen(false); }}
                    className="w-full text-start px-3 py-2.5 flex items-center gap-3 transition-colors cursor-pointer hover:bg-[var(--color-surface-2)]"
                    style={{ background: isActive ? 'var(--color-gold-soft)' : 'transparent' }}
                  >
                    <span className="text-lg shrink-0">{opt.flag}</span>
                    <span className="flex-1 min-w-0">
                      <span
                        className="block text-xs font-bold truncate"
                        style={{ color: isActive ? 'var(--color-gold)' : 'var(--color-text)' }}
                      >
                        {opt.label}
                      </span>
                      <span className="block text-[10px] truncate" style={{ color: 'var(--color-text-dim)' }}>
                        {opt.sub}
                      </span>
                    </span>
                    {isActive && <Check size={14} style={{ color: 'var(--color-gold)' }} />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CurrencySwitcher;
