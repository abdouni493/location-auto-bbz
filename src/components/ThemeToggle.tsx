import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { getStoredTheme, onThemeChange, setTheme, type Theme } from '../utils/theme';

/**
 * Hook de thème — renvoie le thème courant et un basculeur.
 * Se resynchronise si le thème change ailleurs (autre bouton, autre onglet).
 */
export const useTheme = (): [Theme, () => void] => {
  const [theme, setLocal] = useState<Theme>(() => getStoredTheme());

  useEffect(() => onThemeChange(setLocal), []);

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return [theme, toggle];
};

interface ThemeToggleProps {
  /** `bar` : bouton de barre de navigation. `pill` : pastille compacte. */
  variant?: 'bar' | 'pill';
  className?: string;
  lang?: 'fr' | 'ar';
}

/**
 * Bascule clair / sombre. Présente dans la barre de l'application ET dans
 * celle du site public.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'bar',
  className = '',
  lang = 'fr',
}) => {
  const [theme, toggle] = useTheme();
  const isDark = theme === 'dark';

  const title = isDark
    ? lang === 'fr' ? 'Passer en mode clair' : 'التبديل إلى الوضع الفاتح'
    : lang === 'fr' ? 'Passer en mode sombre' : 'التبديل إلى الوضع الداكن';

  if (variant === 'pill') {
    return (
      <button
        onClick={toggle}
        title={title}
        aria-label={title}
        className={`relative w-14 h-7 rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${className}`}
        style={{
          background: isDark ? 'var(--color-surface-3)' : 'var(--color-gold-soft)',
          border: '1px solid var(--color-border-soft)',
        }}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="flex items-center justify-center w-6 h-6 rounded-full"
          style={{
            marginLeft: isDark ? 0 : 'auto',
            background: isDark ? 'var(--color-surface)' : 'var(--color-gold)',
            color: isDark ? 'var(--color-gold)' : '#0A0A0B',
          }}
        >
          {isDark ? <Moon size={13} /> : <Sun size={13} />}
        </motion.span>
      </button>
    );
  }

  return (
    <motion.button
      onClick={toggle}
      title={title}
      aria-label={title}
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -2 }}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer ${className}`}
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border-soft)',
        color: 'var(--color-gold)',
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, opacity: 0, rotate: -35 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 35 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
};

export default ThemeToggle;
