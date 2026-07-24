/**
 * Thème clair / sombre.
 *
 * Deux ESPACES indépendants, chacun avec son propre défaut et son propre
 * stockage :
 *
 *   • `app`  — l'application d'administration → CLAIR par défaut
 *   • `site` — le site public (/website)      → SOMBRE par défaut
 *
 * L'espace courant se déduit de l'URL ; passer de l'admin au site (et
 * inversement) réapplique automatiquement le thème du nouvel espace, tout en
 * mémorisant le choix fait dans chacun.
 *
 * L'attribut `data-theme` posé sur <html> pilote toutes les variables CSS
 * définies dans src/index.css — aucun composant n'a besoin de connaître le
 * thème pour s'afficher correctement.
 */

export type Theme = 'dark' | 'light';
export type ThemeScope = 'app' | 'site';

/** Une clé de stockage par espace : l'admin et le site ne se marchent pas dessus. */
const STORAGE_KEYS: Record<ThemeScope, string> = {
  app: 'mhd-auto-theme-app',
  site: 'mhd-auto-theme-site',
};

const DEFAULT_THEMES: Record<ThemeScope, Theme> = {
  app: 'light',
  site: 'dark',
};

/** Ancienne clé unique (avant la séparation admin / site) — purgée au démarrage. */
const LEGACY_STORAGE_KEY = 'mhd-auto-theme';

type Listener = (theme: Theme) => void;
const listeners = new Set<Listener>();

const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light';

/** Espace courant. Mis à jour par `setThemeScope` au fil de la navigation. */
let currentScope: ThemeScope = 'app';

/** `/website` (et ses sous-chemins) = site public ; tout le reste = admin. */
export const scopeFromPath = (pathname: string): ThemeScope =>
  pathname.startsWith('/website') && !pathname.startsWith('/website-') ? 'site' : 'app';

export const getThemeScope = (): ThemeScope => currentScope;

/** Thème enregistré pour un espace, ou son défaut. */
export const getStoredTheme = (scope: ThemeScope = currentScope): Theme => {
  if (typeof window === 'undefined') return DEFAULT_THEMES[scope];
  try {
    const saved = window.localStorage.getItem(STORAGE_KEYS[scope]);
    return isTheme(saved) ? saved : DEFAULT_THEMES[scope];
  } catch {
    // localStorage indisponible (navigation privée stricte)
    return DEFAULT_THEMES[scope];
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

/** Change le thème de l'espace courant, le mémorise et prévient les abonnés. */
export const setTheme = (theme: Theme, scope: ThemeScope = currentScope): void => {
  if (scope === currentScope) applyTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEYS[scope], theme);
  } catch {
    // Sans stockage, le thème vaut pour la session en cours seulement.
  }
  if (scope === currentScope) listeners.forEach(fn => fn(theme));
};

export const toggleTheme = (): Theme => {
  const next: Theme = getStoredTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
};

/**
 * Bascule vers un autre espace (navigation admin ↔ site public) et applique
 * son thème. Sans effet — donc sans re-rendu inutile — si l'espace ne change
 * pas. Retourne le thème appliqué.
 */
export const setThemeScope = (scope: ThemeScope): Theme => {
  const theme = getStoredTheme(scope);
  if (scope === currentScope) {
    // Même espace : on se contente de garantir que le DOM est à jour.
    applyTheme(theme);
    return theme;
  }
  currentScope = scope;
  applyTheme(theme);
  listeners.forEach(fn => fn(theme));
  return theme;
};

/** S'abonne aux changements de thème. Retourne la fonction de désabonnement. */
export const onThemeChange = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * Applique le thème AVANT le premier rendu de React, pour éviter le flash de
 * couleur au chargement. Appelé depuis src/main.tsx.
 */
export const initTheme = (): Theme => {
  if (typeof window === 'undefined') return DEFAULT_THEMES.app;

  // Purge l'ancienne clé commune : sans cela, un ancien choix « sombre »
  // empêcherait le nouveau défaut clair de l'admin de s'appliquer.
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* stockage indisponible */
  }

  currentScope = scopeFromPath(window.location.pathname);
  const theme = getStoredTheme(currentScope);
  applyTheme(theme);

  // Un autre onglet a changé le thème de CE même espace → on suit.
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEYS[currentScope] || !isTheme(e.newValue)) return;
    applyTheme(e.newValue);
    listeners.forEach(fn => fn(e.newValue as Theme));
  });

  return theme;
};
