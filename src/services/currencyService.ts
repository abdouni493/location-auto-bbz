import { supabase } from '../supabase';
import type { CurrencyCode, CurrencySetting } from '../types';
import { DEFAULT_CURRENCIES, CURRENCY_ORDER } from '../utils/currency';

/**
 * Registre global des devises (table `currency_settings`).
 *
 * Le DZD est la devise de base : toujours active, taux figé à 1 (un trigger
 * SQL le garantit). Les autres devises sont activées à la main depuis la
 * gestion du site, avec leur taux de change.
 *
 * La liste est mise en cache en mémoire : elle est lue par le site public à
 * chaque rendu de carte véhicule, inutile d'aller en base à chaque fois.
 */

const mapRow = (row: any): CurrencySetting => ({
  code: row.code as CurrencyCode,
  label: row.label ?? row.code,
  symbol: row.symbol ?? row.code,
  rateToDzd: Number(row.rate_to_dzd) || 1,
  isActive: row.is_active === true,
  isBase: row.is_base === true,
  displayOrder: Number(row.display_order) || 0,
});

let cache: { at: number; data: CurrencySetting[] } | null = null;
const CACHE_TTL_MS = 60_000;

export const CurrencyService = {
  /** Vide le cache — à appeler après toute écriture. */
  invalidate() {
    cache = null;
  },

  /** Toutes les devises connues, base en tête. */
  async getAll(force = false): Promise<CurrencySetting[]> {
    if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

    try {
      const { data, error } = await supabase
        .from('currency_settings')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      const rows = (data || []).map(mapRow);
      // Si la migration n'a pas encore tourné, on retombe sur les valeurs par défaut
      // pour que l'app continue de fonctionner en DZD seul.
      const result = rows.length > 0 ? rows : DEFAULT_CURRENCIES;
      cache = { at: Date.now(), data: result };
      return result;
    } catch (err) {
      console.warn('[CurrencyService] lecture impossible, repli sur les devises par défaut', err);
      return DEFAULT_CURRENCIES;
    }
  },

  /** Devises proposées aux clients (base incluse). */
  async getActive(force = false): Promise<CurrencySetting[]> {
    const all = await this.getAll(force);
    return all
      .filter(c => c.isActive || c.isBase)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async getByCode(code: CurrencyCode): Promise<CurrencySetting | undefined> {
    return (await this.getAll()).find(c => c.code === code);
  },

  /** Taux d'une devise (DZD par unité). Retourne 1 si inconnue. */
  async getRate(code: CurrencyCode): Promise<number> {
    if (code === 'DZD') return 1;
    return (await this.getByCode(code))?.rateToDzd ?? 1;
  },

  /** Active/désactive une devise et/ou met à jour son taux. */
  async update(
    code: CurrencyCode,
    updates: { rateToDzd?: number; isActive?: boolean; symbol?: string; label?: string }
  ): Promise<CurrencySetting> {
    const payload: Record<string, any> = {};
    if (updates.rateToDzd !== undefined) payload.rate_to_dzd = updates.rateToDzd;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.symbol !== undefined) payload.symbol = updates.symbol;
    if (updates.label !== undefined) payload.label = updates.label;

    const { data, error } = await supabase
      .from('currency_settings')
      .update(payload)
      .eq('code', code)
      .select()
      .single();

    if (error) throw error;
    this.invalidate();
    return mapRow(data);
  },

  /** Crée les 4 devises si la table est vide (filet de sécurité). */
  async seed(): Promise<void> {
    const { count, error } = await supabase
      .from('currency_settings')
      .select('code', { count: 'exact', head: true });

    if (error || (count ?? 0) > 0) return;

    await supabase.from('currency_settings').insert(
      DEFAULT_CURRENCIES.map(c => ({
        code: c.code,
        label: c.label,
        symbol: c.symbol,
        rate_to_dzd: c.rateToDzd,
        is_active: c.isActive,
        is_base: c.isBase,
        display_order: c.displayOrder,
      }))
    );
    this.invalidate();
  },
};

/** Ordre d'affichage canonique, réexporté pour les écrans de réglage. */
export { CURRENCY_ORDER };
