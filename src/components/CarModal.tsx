import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Language, CarCurrencyConfig, CurrencyCode, CurrencySetting } from '../types';
import { X, Plus, Loader2, User, Users, RefreshCw, Check } from 'lucide-react';
import { uploadCarImage } from '../services/uploadCarImage';
import { CurrencyService } from '../services/currencyService';
import {
  CURRENCY_META,
  derivePricingFromRate,
  formatCurrency,
} from '../utils/currency';

interface CarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (car: Partial<Car>) => void;
  onDelete?: (id: string) => void;
  car?: Car;
  lang: Language;
}

/** Devises étrangères proposées dans le formulaire (le DZD est la base). */
const FOREIGN: Exclude<CurrencyCode, 'DZD'>[] = ['USD', 'EUR', 'GBP'];

const emptyForm = (): Partial<Car> => ({
  brand: '',
  model: '',
  registration: '',
  year: new Date().getFullYear(),
  color: '',
  vin: '',
  energy: 'Essence',
  transmission: 'Manuelle',
  seats: 5,
  doors: 5,
  priceDay: 0,
  priceWeek: 0,
  priceMonth: 0,
  deposit: 0,
  images: [],
  mileage: 0,
  ownerType: 'personal',
  ownerName: '',
  ownerPhone: '',
  agencyDailyShare: 0,
  currencyConfig: {},
});

export const CarModal: React.FC<CarModalProps> = ({ isOpen, onClose, onSave, onDelete, car, lang }) => {
  const [formData, setFormData] = useState<Partial<Car>>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [globalRates, setGlobalRates] = useState<Record<string, number>>({});

  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  useEffect(() => {
    setFormData(car ? { ...emptyForm(), ...car } : emptyForm());
  }, [car, isOpen]);

  // Taux globaux : servent de valeur de départ quand l'utilisateur active une
  // devise sur une voiture qui n'en avait pas encore.
  useEffect(() => {
    if (!isOpen) return;
    CurrencyService.getAll()
      .then(list =>
        setGlobalRates(Object.fromEntries(list.map(c => [c.code, c.rateToDzd])))
      )
      .catch(() => setGlobalRates({}));
  }, [isOpen]);

  if (!isOpen) return null;

  const isThirdParty = formData.ownerType === 'third_party';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numeric =
      name === 'year' || name === 'seats' || name === 'doors' ||
      name.startsWith('price') || name === 'deposit' || name === 'mileage' ||
      name === 'agencyDailyShare';

    setFormData(prev => ({ ...prev, [name]: numeric ? Number(value) : value }));
  };

  // ── Devises ──────────────────────────────────────────────────────────────

  const currencyConfig: CarCurrencyConfig = formData.currencyConfig ?? {};

  const setCurrency = (
    code: Exclude<CurrencyCode, 'DZD'>,
    patch: Partial<NonNullable<CarCurrencyConfig[typeof code]>>
  ) => {
    setFormData(prev => {
      const cfg = { ...(prev.currencyConfig ?? {}) };
      const current = cfg[code] ?? {
        active: false, rate: 0, priceDay: 0, priceWeek: 0, priceMonth: 0, deposit: 0,
      };
      cfg[code] = { ...current, ...patch };
      return { ...prev, currencyConfig: cfg };
    });
  };

  /** Active une devise : pré-remplit le taux global puis calcule tous les prix. */
  const toggleCurrency = (code: Exclude<CurrencyCode, 'DZD'>) => {
    const existing = currencyConfig[code];
    if (existing?.active) {
      setCurrency(code, { active: false });
      return;
    }
    const rate = existing?.rate || globalRates[code] || 0;
    setCurrency(code, {
      active: true,
      rate,
      ...(rate > 0 ? derivePricingFromRate(formData as Car, rate, code) : {}),
    });
  };

  /**
   * Le taux de change change → jour / semaine / mois / caution sont recalculés
   * automatiquement depuis les prix en dinars.
   */
  const handleRateChange = (code: Exclude<CurrencyCode, 'DZD'>, rawRate: string) => {
    const rate = Number(rawRate);
    setCurrency(code, {
      rate,
      ...(rate > 0 ? derivePricingFromRate(formData as Car, rate, code) : {}),
    });
  };

  /** Recalcule toutes les devises actives (après avoir modifié un prix DZD). */
  const recomputeAll = () => {
    setFormData(prev => {
      const cfg = { ...(prev.currencyConfig ?? {}) };
      FOREIGN.forEach(code => {
        const c = cfg[code];
        if (c?.active && c.rate > 0) {
          cfg[code] = { ...c, ...derivePricingFromRate(prev as Car, c.rate, code) };
        }
      });
      return { ...prev, currencyConfig: cfg };
    });
  };

  const activeCurrencyCount = FOREIGN.filter(c => currencyConfig[c]?.active).length;

  // ── Images ───────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploadingImages(true);
    try {
      const newImages: string[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadCarImage(file as File, car?.id);
        if (result.success && result.url) newImages.push(result.url);
      }
      setFormData(prev => ({
        ...prev,
        images: newImages.length > 0 ? [...(prev.images ?? []), ...newImages] : prev.images,
      }));
    } catch (err) {
      console.error('Error uploading images:', err);
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) =>
    setFormData(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== index) }));

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────

  const sectionTitle = (icon: string, label: string) => (
    <h3
      className="text-xs font-black flex items-center gap-3 uppercase tracking-[0.2em]"
      style={{ color: 'var(--color-gold)' }}
    >
      <span className="p-2 rounded-lg" style={{ background: 'var(--color-gold-soft)' }}>{icon}</span>
      {label}
    </h3>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-5xl rounded-[2rem] overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lift)',
        }}
      >
        {/* En-tête */}
        <div
          className="p-8 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))',
            color: '#0A0A0B',
          }}
        >
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              {car ? `✏️ ${T('Modifier Véhicule', 'تعديل المركبة')}` : `🚗 ${T('Nouveau Véhicule', 'مركبة جديدة')}`}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">
              {T('Gestion de flotte professionnelle', 'إدارة الأسطول الاحترافية')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl transition-colors hover:bg-black/10 cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar"
          style={{ background: 'var(--color-bg)' }}
        >
          {/* ── Propriétaire ───────────────────────────────────────────── */}
          <section className="space-y-5">
            {sectionTitle('🔑', T('Propriétaire du véhicule', 'مالك المركبة'))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                {
                  value: 'personal' as const,
                  icon: <User size={22} />,
                  title: T('Voiture personnelle', 'سيارة شخصية'),
                  desc: T("Le véhicule appartient à l'agence. Tous les bénéfices lui reviennent.",
                          'المركبة ملك للوكالة. كل الأرباح لها.'),
                },
                {
                  value: 'third_party' as const,
                  icon: <Users size={22} />,
                  title: T("Voiture d'une autre personne", 'سيارة شخص آخر'),
                  desc: T("L'agence garde un montant fixe par jour ; le reste revient au propriétaire.",
                          'تحتفظ الوكالة بمبلغ ثابت يوميًا والباقي للمالك.'),
                },
              ]).map(opt => {
                const selected = (formData.ownerType ?? 'personal') === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    type="button"
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setFormData(prev => ({ ...prev, ownerType: opt.value }))}
                    className="text-left p-5 rounded-2xl transition-all cursor-pointer relative overflow-hidden"
                    style={{
                      background: selected ? 'var(--color-gold-soft)' : 'var(--color-surface)',
                      border: `1.5px solid ${selected ? 'var(--color-gold)' : 'var(--color-border-soft)'}`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="p-2.5 rounded-xl shrink-0"
                        style={{
                          background: selected ? 'var(--color-gold)' : 'var(--color-surface-2)',
                          color: selected ? '#0A0A0B' : 'var(--color-text-muted)',
                        }}
                      >
                        {opt.icon}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="font-black text-sm uppercase tracking-tight"
                          style={{ color: selected ? 'var(--color-gold)' : 'var(--color-text)' }}
                        >
                          {opt.title}
                        </p>
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                          {opt.desc}
                        </p>
                      </div>
                      {selected && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--color-gold)', color: '#0A0A0B' }}
                        >
                          <Check size={13} strokeWidth={3} />
                        </motion.span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Champs propriétaire tiers */}
            <AnimatePresence initial={false}>
              {isThirdParty && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-2xl"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px dashed var(--color-vel-border-gold)',
                    }}
                  >
                    <div className="space-y-2">
                      <label className="label-saas">{T('Nom du propriétaire', 'اسم المالك')}</label>
                      <input
                        name="ownerName"
                        value={formData.ownerName ?? ''}
                        onChange={handleChange}
                        className="input-saas"
                        placeholder={T('ex : Karim Benali', 'مثال: كريم بن علي')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="label-saas">{T('Téléphone du propriétaire', 'هاتف المالك')}</label>
                      <input
                        name="ownerPhone"
                        value={formData.ownerPhone ?? ''}
                        onChange={handleChange}
                        className="input-saas"
                        placeholder="0555 00 00 00"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="label-saas">
                        {T("Part de l'agence / jour (DA)", 'حصة الوكالة / يوم (دج)')}
                      </label>
                      <input
                        name="agencyDailyShare"
                        type="number"
                        min={0}
                        value={formData.agencyDailyShare ?? 0}
                        onChange={handleChange}
                        className="input-saas"
                      />
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
                        {T(
                          "Montant que l'agence conserve pour chaque jour loué. Le reste du prix journalier revient au propriétaire.",
                          'المبلغ الذي تحتفظ به الوكالة عن كل يوم إيجار. الباقي للمالك.'
                        )}
                      </p>
                    </div>

                    {/* Aperçu de la répartition */}
                    {(formData.priceDay ?? 0) > 0 && (
                      <div className="md:col-span-3 flex flex-wrap items-center gap-3 pt-1">
                        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                          {T('Répartition / jour', 'التوزيع / يوم')}
                        </span>
                        <span
                          className="px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{ background: 'var(--color-gold-soft)', color: 'var(--color-gold)' }}
                        >
                          {T('Agence', 'الوكالة')} : {formatCurrency(formData.agencyDailyShare ?? 0)}
                        </span>
                        <span
                          className="px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-act-success)' }}
                        >
                          {T('Propriétaire', 'المالك')} :{' '}
                          {formatCurrency(Math.max(0, (formData.priceDay ?? 0) - (formData.agencyDailyShare ?? 0)))}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* ── Photos ─────────────────────────────────────────────────── */}
          <section className="space-y-5">
            {sectionTitle('📸', T('Media & Photos', 'الصور والوسائط'))}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formData.images?.map((img, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative aspect-video rounded-2xl overflow-hidden group"
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  <img src={img} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-2 right-2 p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ background: 'var(--color-act-delete)', color: '#fff' }}
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              ))}
              <label
                className="aspect-video rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group"
                style={{
                  border: '2px dashed var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-muted)',
                }}
                onClick={e => { if (uploadingImages) e.preventDefault(); }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors group-hover:text-[var(--color-gold)]"
                  style={{ background: 'var(--color-surface-2)' }}
                >
                  {uploadingImages ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {uploadingImages ? T('Upload en cours...', 'جاري الرفع...') : T('Ajouter des photos', 'إضافة صور')}
                </span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploadingImages} />
              </label>
            </div>
          </section>

          {/* ── Informations générales ─────────────────────────────────── */}
          <section className="space-y-5">
            {sectionTitle('🏷️', T('Informations Générales', 'معلومات عامة'))}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="label-saas">{T('Marque', 'العلامة')}</label>
                <input name="brand" value={formData.brand ?? ''} onChange={handleChange} className="input-saas" placeholder="ex: Mercedes-Benz" />
              </div>
              <div className="space-y-2">
                <label className="label-saas">{T('Modèle', 'الطراز')}</label>
                <input name="model" value={formData.model ?? ''} onChange={handleChange} className="input-saas" placeholder="ex: S-Class" />
              </div>
              <div className="space-y-2">
                <label className="label-saas">{T('Immatriculation', 'رقم التسجيل')}</label>
                <input name="registration" value={formData.registration ?? ''} onChange={handleChange} className="input-saas" placeholder="ex: 12345-123-16" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label-saas">{T('Année', 'السنة')}</label>
                  <input name="year" type="number" value={formData.year ?? ''} onChange={handleChange} className="input-saas" />
                </div>
                <div className="space-y-2">
                  <label className="label-saas">{T('Couleur', 'اللون')}</label>
                  <input name="color" value={formData.color ?? ''} onChange={handleChange} className="input-saas" placeholder="ex: Obsidian Black" />
                </div>
              </div>
            </div>
          </section>

          {/* ── Fiche technique ────────────────────────────────────────── */}
          <section className="space-y-5">
            {sectionTitle('⚙️', T('Fiche Technique', 'المواصفات التقنية'))}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
              <div className="space-y-2">
                <label className="label-saas">{T('Énergie', 'الطاقة')}</label>
                <select name="energy" value={formData.energy} onChange={handleChange} className="input-saas">
                  <option>Essence</option><option>Diesel</option><option>Hybride</option><option>Électrique</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="label-saas">{T('Boîte', 'ناقل الحركة')}</label>
                <select name="transmission" value={formData.transmission} onChange={handleChange} className="input-saas">
                  <option>Manuelle</option><option>Automatique</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="label-saas">{T('Places', 'المقاعد')}</label>
                <input name="seats" type="number" value={formData.seats ?? ''} onChange={handleChange} className="input-saas" />
              </div>
              <div className="space-y-2">
                <label className="label-saas">{T('Portes', 'الأبواب')}</label>
                <input name="doors" type="number" value={formData.doors ?? ''} onChange={handleChange} className="input-saas" />
              </div>
              <div className="space-y-2">
                <label className="label-saas">{T('Kilométrage', 'المسافة')}</label>
                <input name="mileage" type="number" value={formData.mileage ?? ''} onChange={handleChange} className="input-saas" />
              </div>
            </div>
            <div className="space-y-2 max-w-md">
              <label className="label-saas">{T('VIN (Châssis)', 'رقم الهيكل')}</label>
              <input name="vin" value={formData.vin ?? ''} onChange={handleChange} className="input-saas" placeholder={T('Numéro de châssis', 'رقم الهيكل')} />
            </div>
          </section>

          {/* ── Tarification DZD ───────────────────────────────────────── */}
          <section className="space-y-5">
            {sectionTitle('💰', T('Tarification en dinars (DZD)', 'التسعير بالدينار'))}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {([
                ['priceDay',   T('Prix / Jour', 'السعر / يوم')],
                ['priceWeek',  T('Prix / Semaine', 'السعر / أسبوع')],
                ['priceMonth', T('Prix / Mois', 'السعر / شهر')],
                ['deposit',    T('Caution', 'الضمان')],
              ] as const).map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <label className="label-saas">{label}</label>
                  <input
                    name={field}
                    type="number"
                    min={0}
                    value={(formData as any)[field] ?? 0}
                    onChange={handleChange}
                    onBlur={recomputeAll}
                    className="input-saas"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
              {T(
                'Le dinar est la devise de référence : les prix des autres devises en sont déduits automatiquement.',
                'الدينار هو العملة المرجعية: تُحسب أسعار العملات الأخرى منه تلقائيًا.'
              )}
            </p>
          </section>

          {/* ── Devises étrangères ─────────────────────────────────────── */}
          <section className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {sectionTitle('🌍', T('Autres devises', 'عملات أخرى'))}
              {activeCurrencyCount > 0 && (
                <button
                  type="button"
                  onClick={recomputeAll}
                  className="btn-act-neutral !px-4 !py-2 !text-xs"
                >
                  <RefreshCw size={14} />
                  {T('Recalculer tous les prix', 'إعادة حساب الأسعار')}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {FOREIGN.map(code => {
                const cfg = currencyConfig[code];
                const active = cfg?.active === true;
                const meta = CURRENCY_META[code];

                return (
                  <div
                    key={code}
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{
                      background: 'var(--color-surface)',
                      border: `1px solid ${active ? 'var(--color-vel-border-gold)' : 'var(--color-border-soft)'}`,
                    }}
                  >
                    {/* Bandeau : activer / désactiver */}
                    <div className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl">{meta.flag}</span>
                        <div className="min-w-0">
                          <p className="font-black text-sm" style={{ color: active ? 'var(--color-gold)' : 'var(--color-text)' }}>
                            {code} — {meta.label}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                            {active
                              ? T('Affichée sur le site public', 'تُعرض على الموقع')
                              : T('Non proposée pour ce véhicule', 'غير متاحة لهذه المركبة')}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        onClick={() => toggleCurrency(code)}
                        className="relative w-12 h-6 rounded-full shrink-0 transition-colors cursor-pointer"
                        style={{
                          background: active ? 'var(--color-gold)' : 'var(--color-surface-3)',
                          border: '1px solid var(--color-border-soft)',
                        }}
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                          className="absolute top-0.5 w-5 h-5 rounded-full"
                          style={{
                            left: active ? 'calc(100% - 1.375rem)' : '0.125rem',
                            background: active ? '#0A0A0B' : 'var(--color-text-muted)',
                          }}
                        />
                      </button>
                    </div>

                    {/* Taux + prix calculés */}
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div
                            className="p-5 pt-1 space-y-4"
                            style={{ borderTop: '1px dashed var(--color-border-soft)' }}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                              <div className="space-y-2">
                                <label className="label-saas">
                                  {T('Taux de change', 'سعر الصرف')}
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={cfg?.rate || ''}
                                    onChange={e => handleRateChange(code, e.target.value)}
                                    className="input-saas"
                                    placeholder="0"
                                  />
                                </div>
                                <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                                  1 {meta.symbol} = {cfg?.rate || 0} DA
                                </p>
                              </div>

                              {([
                                ['priceDay',   T('Jour', 'يوم')],
                                ['priceWeek',  T('Semaine', 'أسبوع')],
                                ['priceMonth', T('Mois', 'شهر')],
                                ['deposit',    T('Caution', 'الضمان')],
                              ] as const).map(([field, label]) => (
                                <div key={field} className="space-y-2">
                                  <label className="label-saas">{label} ({meta.symbol})</label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={cfg?.[field] ?? 0}
                                    onChange={e => setCurrency(code, { [field]: Number(e.target.value) } as any)}
                                    className="input-saas"
                                  />
                                </div>
                              ))}
                            </div>

                            <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                              {T(
                                'Modifiez le taux pour recalculer les quatre montants, ou ajustez-les un par un pour arrondir.',
                                'غيّر سعر الصرف لإعادة حساب المبالغ الأربعة، أو عدّلها واحدة تلو الأخرى للتقريب.'
                              )}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Pied */}
        <div
          className="p-6 flex items-center justify-between gap-4"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div>
            {car && onDelete && (
              <button onClick={() => onDelete(car.id)} className="btn-saas-danger px-8" disabled={isSubmitting}>
                {T('Supprimer', 'حذف')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="btn-saas-outline px-8" disabled={isSubmitting}>
              {T('Annuler', 'إلغاء')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting || uploadingImages}
              className="btn-saas-primary px-12"
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" />{T('Enregistrement...', 'جاري الحفظ...')}</>
              ) : (
                T('Enregistrer le véhicule', 'حفظ المركبة')
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
