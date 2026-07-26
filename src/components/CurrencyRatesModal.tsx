import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, RefreshCw, Check, AlertTriangle, Globe } from 'lucide-react';
import type { Car, CarCurrencyConfig, CurrencyCode, Language } from '../types';
import { CurrencyService } from '../services/currencyService';
import { updateCar } from '../services/carService';
import { CURRENCY_META, derivePricingFromRate, formatCurrency } from '../utils/currency';

/** Devises étrangères réglables ici (le dinar est la devise de référence). */
const FOREIGN: Exclude<CurrencyCode, 'DZD'>[] = ['USD', 'EUR', 'GBP'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  /** Parc complet : c'est lui qui sera recalculé au taux saisi. */
  cars: Car[];
  /** Nouvelles configurations devises, par identifiant de véhicule. */
  onApplied: (configs: Record<string, CarCurrencyConfig>) => void;
}

interface RateDraft {
  rate: number | '';
  active: boolean;
  /** Valeurs enregistrées, pour détecter ce qui a réellement changé. */
  savedRate: number;
  savedActive: boolean;
}

/**
 * Taux de change du parc.
 *
 * Un seul taux par devise, valable pour TOUT le parc : dès qu'il change, les
 * tarifs (jour / semaine / mois / caution) de chaque véhicule sont recalculés
 * depuis ses prix en dinars — plus besoin d'ouvrir les voitures une par une.
 */
export const CurrencyRatesModal: React.FC<Props> = ({ isOpen, onClose, lang, cars, onApplied }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const [drafts, setDrafts] = useState<Record<string, RateDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDone(null);
    setLoading(true);
    CurrencyService.getAll(true)
      .then(list => {
        const next: Record<string, RateDraft> = {};
        FOREIGN.forEach(code => {
          const found = list.find(c => c.code === code);
          const rate = found?.rateToDzd ?? 0;
          const active = found?.isActive ?? false;
          next[code] = { rate: rate || '', active, savedRate: rate, savedActive: active };
        });
        setDrafts(next);
      })
      .catch(err => {
        console.error('[CurrencyRatesModal] lecture des devises impossible', err);
        setError(T('Impossible de charger les devises.', 'تعذّر تحميل العملات.'));
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const setDraft = (code: string, patch: Partial<RateDraft>) =>
    setDrafts(prev => ({ ...prev, [code]: { ...prev[code], ...patch } }));

  /** Devises dont le taux ou l'activation a bougé. */
  const changed = FOREIGN.filter(code => {
    const d = drafts[code];
    if (!d) return false;
    const rate = d.rate === '' ? 0 : Number(d.rate);
    return rate !== d.savedRate || d.active !== d.savedActive;
  });

  const handleApply = async () => {
    if (changed.length === 0) {
      onClose();
      return;
    }

    // Un taux à zéro sur une devise activée ne produirait que des prix nuls.
    const invalid = changed.find(code => {
      const d = drafts[code];
      return d.active && (d.rate === '' || Number(d.rate) <= 0);
    });
    if (invalid) {
      setError(T(
        `Saisissez un taux supérieur à 0 pour le ${invalid}.`,
        `أدخل سعر صرف أكبر من 0 للعملة ${invalid}.`
      ));
      return;
    }

    setSaving(true);
    setError(null);
    setDone(null);

    try {
      // 1) Le taux global d'abord : il sert de valeur par défaut partout ailleurs.
      for (const code of changed) {
        const d = drafts[code];
        await CurrencyService.update(code as CurrencyCode, {
          rateToDzd: d.rate === '' ? 0 : Number(d.rate),
          isActive: d.active,
        });
      }

      // 2) Puis TOUT le parc, au même taux.
      const configs: Record<string, CarCurrencyConfig> = {};
      const failures: string[] = [];

      for (const car of cars) {
        const cfg: CarCurrencyConfig = { ...(car.currencyConfig || {}) };
        changed.forEach(code => {
          const d = drafts[code];
          const rate = d.rate === '' ? 0 : Number(d.rate);
          if (d.active && rate > 0) {
            cfg[code] = {
              active: true,
              rate,
              ...derivePricingFromRate(car, rate, code),
            };
          } else {
            // Devise désactivée globalement : elle disparaît du site public.
            const existing = cfg[code];
            cfg[code] = {
              active: false,
              rate: rate || existing?.rate || 0,
              priceDay: existing?.priceDay ?? 0,
              priceWeek: existing?.priceWeek ?? 0,
              priceMonth: existing?.priceMonth ?? 0,
              deposit: existing?.deposit ?? 0,
            };
          }
        });

        const result = await updateCar(car.id, { currency_config: cfg } as any);
        if (result.success) configs[car.id] = cfg;
        else failures.push(`${car.brand} ${car.model}`);
      }

      onApplied(configs);
      setDrafts(prev => {
        const next = { ...prev };
        changed.forEach(code => {
          const d = next[code];
          next[code] = { ...d, savedRate: d.rate === '' ? 0 : Number(d.rate), savedActive: d.active };
        });
        return next;
      });

      const updatedCount = Object.keys(configs).length;
      setDone(T(
        `${updatedCount} véhicule(s) mis à jour au nouveau taux.`,
        `تم تحديث ${updatedCount} مركبة بسعر الصرف الجديد.`
      ));
      if (failures.length > 0) {
        setError(T(
          `Échec sur : ${failures.join(', ')}.`,
          `فشل على: ${failures.join(', ')}.`
        ));
      }
    } catch (err: any) {
      console.error('[CurrencyRatesModal] application des taux impossible', err);
      setError(err?.message || T("Enregistrement impossible.", 'تعذّر الحفظ.'));
    } finally {
      setSaving(false);
    }
  };

  // Aperçu : ce que devient le prix/jour du premier véhicule au taux saisi.
  const sample = cars.find(c => (c.priceDay || 0) > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-3xl rounded-[2rem] overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lift)',
        }}
      >
        {/* En-tête */}
        <div
          className="p-7 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))',
            color: '#0A0A0B',
          }}
        >
          <div className="min-w-0">
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Globe size={24} /> {T('Taux de change', 'أسعار الصرف')}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">
              {T('Appliqués à tout le parc automobile', 'تُطبَّق على كل الأسطول')}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl transition-colors hover:bg-black/10 cursor-pointer">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-7 space-y-5 custom-scrollbar" style={{ background: 'var(--color-bg)' }}>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {T(
              `Le dinar reste la devise de référence. En modifiant un taux ici, les tarifs (jour, semaine, mois, caution) des ${cars.length} véhicule(s) sont recalculés depuis leurs prix en dinars.`,
              `الدينار هو العملة المرجعية. عند تغيير سعر الصرف هنا، تُعاد حسابة أسعار (اليوم، الأسبوع، الشهر، الضمان) لـ ${cars.length} مركبة من أسعارها بالدينار.`
            )}
          </p>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-gold)' }} />
            </div>
          ) : (
            <div className="space-y-4">
              {FOREIGN.map(code => {
                const d = drafts[code];
                if (!d) return null;
                const meta = CURRENCY_META[code];
                const rate = d.rate === '' ? 0 : Number(d.rate);
                const preview = sample && rate > 0
                  ? derivePricingFromRate(sample, rate, code)
                  : null;

                return (
                  <div
                    key={code}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: 'var(--color-surface)',
                      border: `1px solid ${d.active ? 'var(--color-vel-border-gold)' : 'var(--color-border-soft)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl">{meta.flag}</span>
                        <div className="min-w-0">
                          <p
                            className="font-black text-sm"
                            style={{ color: d.active ? 'var(--color-gold)' : 'var(--color-text)' }}
                          >
                            {code} — {meta.label}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                            {d.active
                              ? T('Proposée aux clients sur le site', 'متاحة للعملاء على الموقع')
                              : T('Masquée du site public', 'مخفية عن الموقع')}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={d.active}
                        onClick={() => setDraft(code, { active: !d.active })}
                        className="relative w-12 h-6 rounded-full shrink-0 transition-colors cursor-pointer"
                        style={{
                          background: d.active ? 'var(--color-gold)' : 'var(--color-surface-3)',
                          border: '1px solid var(--color-border-soft)',
                        }}
                      >
                        <span
                          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                          style={{
                            left: d.active ? 'calc(100% - 1.375rem)' : '0.125rem',
                            background: d.active ? '#0A0A0B' : 'var(--color-text-muted)',
                          }}
                        />
                      </button>
                    </div>

                    <div
                      className="p-5 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5 items-start"
                      style={{ borderTop: '1px dashed var(--color-border-soft)' }}
                    >
                      <div className="space-y-2">
                        <label className="label-saas">
                          {T('Taux de change', 'سعر الصرف')} — 1 {meta.symbol} = ? DA
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={d.rate}
                          onChange={e => setDraft(code, { rate: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="input-saas"
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <p className="label-saas">{T('Aperçu sur un véhicule', 'معاينة على مركبة')}</p>
                        {preview && sample ? (
                          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                            {sample.brand} {sample.model} :{' '}
                            <strong style={{ color: 'var(--color-gold)' }}>
                              {formatCurrency(sample.priceDay)}
                            </strong>
                            {' → '}
                            <strong style={{ color: 'var(--color-gold)' }}>
                              {formatCurrency(preview.priceDay, code, { symbol: meta.symbol })}
                            </strong>
                            {' / '}{T('jour', 'يوم')}
                          </p>
                        ) : (
                          <p className="text-[12px]" style={{ color: 'var(--color-text-dim)' }}>
                            {T('Saisissez un taux pour voir le résultat.', 'أدخل سعر صرف لرؤية النتيجة.')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm font-bold p-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--color-act-delete)' }}
              >
                <AlertTriangle size={16} /> {error}
              </motion.p>
            )}
            {done && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm font-bold p-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.10)', color: 'var(--color-act-success)' }}
              >
                <Check size={16} /> {done}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Pied */}
        <div
          className="p-6 flex items-center justify-end gap-4"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <button onClick={onClose} className="btn-saas-outline px-8" disabled={saving}>
            {T('Fermer', 'إغلاق')}
          </button>
          <button
            onClick={handleApply}
            disabled={saving || loading || changed.length === 0}
            className="btn-saas-primary px-10 disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" />{T('Application en cours...', 'جارٍ التطبيق...')}</>
            ) : (
              <><RefreshCw size={18} />{T('Appliquer à tous les véhicules', 'تطبيق على كل المركبات')}</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CurrencyRatesModal;
