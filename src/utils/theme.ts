/**
 * Thème clair / sombre.
 *
 * Le mode SOMBRE (fond noir, boutons or) est le défaut de l'application et du
 * site public. L'attribut `data-theme` posé sur <html> pilote toutes les
 * variables CSS définies dans src/index.css — aucun composant n'a besoin de
 * connaître le thème pour s'afficher correctement.
 *
 * Le choix est mémorisé dans localStorage et partagé entre l'admin et le site
 * public (même origine), pour qu'un aller-retour ne réinitialise rien.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'mhd-auto-theme';
const DEFAULT_THEME: Theme = 'dark';

type Listener = (theme: Theme) => void;
const listeners = new Set<Listener>();

const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light';

/** Thème enregistré, ou le défaut (sombre). */
export const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    // localStorage indisponible (navigation privée stricte)
    return DEFAULT_THEME;
  }
};

/** Applique le thème au document sans passer par le stockage. */
export const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;

  // Accorde la barre d'adresse mobile à la couleur de fond.
  const meta = document.querySelector('meta[name="theme-color"]');
  const color = theme === 'dark' ? '#08080A' : '#F7F7F9';
  if (meta) meta.setAttribute('content', color);
  else {
    const el = document.createElement('meta');
    el.name = 'theme-color';
    el.content = color;
    document.head.appendChild(el);
  }
};

/** Change le thème, le mémorise et prévient les abonnés. */
export const setTheme = (theme: Theme): void => {
  applyTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sans stockage, le thème vaut pour la session en cours seulement.
  }
  listeners.forEach(fn => fn(theme));
};

export const toggleTheme = (): Theme => {
  const next: Theme = getStoredTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
};

/** S'abonne aux changements de thème. Retourne la fonction de désabonnement. */
export const onThemeChange = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * Applique le thème AVANT le premier rendu de React, pour éviter le flash
 * blanc au chargement. Appelé depuis src/main.tsx.
 */
export const initTheme = (): Theme => {
  const theme = getStoredTheme();
  applyTheme(theme);

  // Un autre onglet a changé le thème → on suit.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
      if (e.key === STORAGE_KEY && isTheme(e.newValue)) {
        applyTheme(e.newValue);
        listeners.forEach(fn => fn(e.newValue as Theme));
      }
    });
  }

  return theme;
};
