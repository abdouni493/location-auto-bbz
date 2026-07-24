import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gauge, Settings2, Loader2, Check, AlertTriangle } from 'lucide-react';
import type { Language, MileagePolicy } from '../../types';
import { SettingsService, DEFAULT_MILEAGE_POLICY, mileageLimitFor } from '../../services/settingsService';

interface Props {
  lang: Language;
  /** Durée de la location, pour afficher la limite effective en km. */
  totalDays: number;
  policy: MileagePolicy;
  onPolicyChange: (p: MileagePolicy) => void;
}

/**
 * Paramétrage de la politique kilométrique, accessible depuis la fenêtre
 * « Terminer la location ».
 *
 * Le réglage est GLOBAL : il est enregistré dans `app_settings` et s'applique
 * à la clôture de toutes les locations, pas seulement celle en cours.
 */
export const MileagePolicyPanel: React.FC<Props> = ({ lang, totalDays, policy, onPolicyChange }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<MileagePolicy>(policy);

  useEffect(() => setDraft(policy), [policy]);

  const limit = mileageLimitFor(draft, totalDays);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await SettingsService.saveMileagePolicy(draft);
      onPolicyChange(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('[MileagePolicy] enregistrement impossible:', err);
      alert(T("Le réglage n'a pas pu être enregistré.", 'تعذر حفظ الإعداد.'));
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key: 'dailyLimitKm' | 'feePerExtraKm' | 'fuelFeePerLevel',
    label: string,
    suffix: string,
    hint: string
  ) => (
    <div>
      <label className="label-saas">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) || 0 }))}
          className="input-saas pr-14"
        />
        <span
          className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none"
          style={{ color: 'var(--color-text-dim)' }}
        >
          {suffix}
        </span>
      </div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-dim)' }}>{hint}</p>
    </div>
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 cursor-pointer"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="p-2 rounded-lg" style={{ background: 'var(--color-gold-soft)', color: 'var(--color-gold)' }}>
            <Gauge size={16} />
          </span>
          <span className="text-start min-w-0">
            <span className="block font-black text-sm uppercase tracking-tight" style={{ color: 'var(--color-text)' }}>
              {T('Politique kilométrique', 'سياسة المسافة')}
            </span>
            <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {draft.enabled && limit
                ? T(
                    `${limit.toLocaleString('fr-FR')} km inclus (${draft.dailyLimitKm} km/jour × ${totalDays} j)`,
                    `${limit.toLocaleString('fr-FR')} كم مشمولة`
                  )
                : T('Kilométrage illimité', 'مسافة غير محدودة')}
            </span>
          </span>
        </span>

        <span className="flex items-center gap-2 shrink-0">
          {saved && <Check size={16} style={{ color: 'var(--color-act-success)' }} />}
          <Settings2 size={16} style={{ color: 'var(--color-text-muted)' }} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 space-y-4" style={{ borderTop: '1px dashed var(--color-border-soft)' }}>
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-[11px]"
                style={{ background: 'rgba(245,158,11,0.10)', color: 'var(--color-act-warning)' }}
              >
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  {T(
                    'Ce réglage est global : il sera appliqué à la clôture de TOUTES les locations.',
                    'هذا الإعداد عام: سيُطبَّق عند إنهاء كل الإيجارات.'
                  )}
                </span>
              </div>

              {/* Activer / désactiver la limite */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={e => setDraft(d => ({ ...d, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--color-gold)' }}
                />
                <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                  {T('Appliquer une limite kilométrique', 'تطبيق حد للمسافة')}
                </span>
              </label>

              {draft.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {field('dailyLimitKm', T('Km inclus par jour', 'كم مشمولة يوميًا'), 'km',
                    T('Multiplié par la durée de la location.', 'تُضرب في مدة الإيجار.'))}
                  {field('feePerExtraKm', T('Frais par km dépassé', 'رسوم كل كم إضافي'), 'DA',
                    T('Facturé au-delà de la limite.', 'تُفوتر بعد تجاوز الحد.'))}
                  {field('fuelFeePerLevel', T('Frais par cran de carburant', 'رسوم كل درجة وقود'), 'DA',
                    T('Par niveau manquant au retour.', 'لكل مستوى ناقص عند العودة.'))}
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.autoApplyFees}
                  onChange={e => setDraft(d => ({ ...d, autoApplyFees: e.target.checked }))}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--color-gold)' }}
                />
                <span className="text-sm" style={{ color: 'var(--color-text-soft)' }}>
                  {T(
                    'Pré-remplir automatiquement les frais supplémentaires calculés',
                    'ملء الرسوم الإضافية المحسوبة تلقائيًا'
                  )}
                </span>
              </label>

              <button type="button" onClick={save} disabled={saving} className="btn-saas-primary w-full">
                {saving
                  ? <><Loader2 size={16} className="animate-spin" />{T('Enregistrement…', 'جاري الحفظ…')}</>
                  : <><Check size={16} />{T('Enregistrer la politique', 'حفظ السياسة')}</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MileagePolicyPanel;
export { DEFAULT_MILEAGE_POLICY };
