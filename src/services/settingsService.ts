import { supabase } from '../supabase';
import type { MileagePolicy, ContractOptions } from '../types';

/**
 * Réglages globaux (table `app_settings`, clé → valeur jsonb).
 *
 * Contient notamment la **politique kilométrique**, paramétrée depuis la
 * fenêtre « Terminer la location » et appliquée à la clôture de TOUTES les
 * locations : limite de km par jour, frais au km dépassé, frais par cran de
 * carburant manquant.
 */

export const DEFAULT_MILEAGE_POLICY: MileagePolicy = {
  enabled: true,
  dailyLimitKm: 200,
  feePerExtraKm: 50,
  fuelFeePerLevel: 1500,
  autoApplyFees: true,
};

export const DEFAULT_CONTRACT_OPTIONS: ContractOptions = {
  showPrices: true,
  showEntreprise: false,
};

const cache = new Map<string, { at: number; value: any }>();
const TTL_MS = 30_000;

async function readSetting<T>(key: string, fallback: T, force = false): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.value as T;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;

    // Ligne absente (migration pas encore appliquée) → valeurs par défaut.
    const value = data?.value ? { ...fallback, ...(data.value as object) } : fallback;
    cache.set(key, { at: Date.now(), value });
    return value as T;
  } catch (err) {
    console.warn(`[SettingsService] lecture de "${key}" impossible, valeurs par défaut`, err);
    return fallback;
  }
}

async function writeSetting<T extends object>(key: string, value: T): Promise<T> {
  const { data, error } = await supabase
    .from('app_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    .select('value')
    .single();

  if (error) throw error;
  cache.set(key, { at: Date.now(), value: data.value });
  return data.value as T;
}

export const SettingsService = {
  invalidate(key?: string) {
    if (key) cache.delete(key);
    else cache.clear();
  },

  // ── Politique kilométrique ───────────────────────────────────────────────
  getMileagePolicy: (force = false) =>
    readSetting<MileagePolicy>('mileage_policy', DEFAULT_MILEAGE_POLICY, force),

  saveMileagePolicy: (policy: MileagePolicy) =>
    writeSetting('mileage_policy', policy),

  // ── Options d'impression du contrat ──────────────────────────────────────
  getContractOptions: (force = false) =>
    readSetting<ContractOptions>('contract_options', DEFAULT_CONTRACT_OPTIONS, force),

  saveContractOptions: (options: ContractOptions) =>
    writeSetting('contract_options', options),

  // ── Accès générique ──────────────────────────────────────────────────────
  get: readSetting,
  set: writeSetting,
};

/**
 * Kilométrage autorisé pour une location, d'après la politique globale.
 * Retourne `null` quand la politique est désactivée (aucune limite).
 */
export const mileageLimitFor = (policy: MileagePolicy, totalDays: number): number | null => {
  if (!policy.enabled) return null;
  const days = Math.max(1, Number(totalDays) || 1);
  return policy.dailyLimitKm * days;
};

/** Ordre des niveaux de carburant, du plus plein au plus vide. */
export const FUEL_LEVELS = ['full', 'half', 'quarter', 'eighth', 'empty'] as const;
export type FuelLevel = (typeof FUEL_LEVELS)[number];

export const FUEL_LABELS: Record<FuelLevel, string> = {
  full: 'Plein',
  half: '1/2',
  quarter: '1/4',
  eighth: '1/8',
  empty: 'Vide',
};

/**
 * Nombre de crans de carburant manquants entre le départ et le retour.
 * 0 si le véhicule revient avec autant (ou plus) de carburant qu'au départ.
 */
export const missingFuelLevels = (departure?: string | null, ret?: string | null): number => {
  if (!departure || !ret) return 0;
  const from = FUEL_LEVELS.indexOf(departure as FuelLevel);
  const to = FUEL_LEVELS.indexOf(ret as FuelLevel);
  if (from < 0 || to < 0) return 0;
  // L'index grandit quand le réservoir se vide.
  return Math.max(0, to - from);
};
