import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, TrendingUp, Printer, Loader2, AlertCircle,
  ChevronDown, Clock, Users, Building2, Wallet, Receipt, FileText,
} from 'lucide-react';
import { Language, Car, ReservationDetails, VehicleExpense } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { ReservationsService } from '../services/ReservationsService';
import { getVehicleExpenses } from '../services/expenseService';
import { generateReportHTML } from './ReportPrintTemplate';
import { generateOwnerReportHTML } from './OwnerReportTemplate';
import { computeCarBenefits, inRange, type CarBenefits } from '../utils/carBenefits';

interface CarGainsPageProps {
  lang: Language;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString('fr-FR');
const fmtD = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

/** Ouvre un document HTML dans une iframe cachée et lance l'impression. */
const printHTML = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 500);
  }, 300);
};

export const CarGainsPage: React.FC<CarGainsPageProps> = ({ lang }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [expandedRes, setExpandedRes] = useState<string | null>(null);
  const [expandedExp, setExpandedExp] = useState<string | null>(null);
  const [tab, setTab] = useState<'rentals' | 'expenses'>('rentals');

  useEffect(() => {
    DatabaseService.getCars()
      .then(list => {
        setCars(list);
        if (list.length > 0) setSelectedCarId(list[0].id);
      })
      .catch(err => console.error('Error loading cars:', err));
  }, []);

  const selectedCar = cars.find(c => c.id === selectedCarId);

  const handleGenerate = async () => {
    if (!selectedCarId || !startDate || !endDate) {
      alert(T('Veuillez sélectionner un véhicule et les dates.', 'يرجى تحديد المركبة والتواريخ.'));
      return;
    }

    setLoading(true);
    try {
      const [resList, expList] = await Promise.all([
        ReservationsService.getReservations(),
        getVehicleExpenses().then(r => r.expenses || []),
      ]);

      setReservations(
        resList.filter(
          r => (r.carId || r.car?.id) === selectedCarId &&
               inRange(r.step1?.departureDate || r.createdAt || '', startDate, endDate)
        )
      );
      setExpenses(
        expList
          .filter(e => e.carId === selectedCarId && inRange(e.date, startDate, endDate))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
      setGenerated(true);
    } catch (err) {
      console.error('Error loading data:', err);
      alert(T('Erreur lors du chargement des données.', 'خطأ في تحميل البيانات.'));
    } finally {
      setLoading(false);
    }
  };

  /** Tous les chiffres viennent d'ici — écran et impression partagent le calcul. */
  const benefits: CarBenefits | null = useMemo(
    () => (selectedCar ? computeCarBenefits(selectedCar, reservations, expenses) : null),
    [selectedCar, reservations, expenses]
  );

  const handlePrintFull = async () => {
    if (!selectedCar) return;
    try {
      const agency = await DatabaseService.getWebsiteSettings();
      printHTML(generateReportHTML(selectedCar, reservations, expenses, startDate, endDate, agency, lang));
    } catch (err) {
      console.error('Error printing report:', err);
      alert(T("Erreur lors de l'impression.", 'خطأ في الطباعة.'));
    }
  };

  /** Rapport pour le propriétaire — n'affiche jamais la part de l'agence. */
  const handlePrintOwner = async () => {
    if (!selectedCar || !benefits) return;
    try {
      const agency = await DatabaseService.getWebsiteSettings();
      printHTML(generateOwnerReportHTML(selectedCar, benefits, startDate, endDate, agency, lang));
    } catch (err) {
      console.error('Error printing owner report:', err);
      alert(T("Erreur lors de l'impression.", 'خطأ في الطباعة.'));
    }
  };

  // ── Fragments de rendu ───────────────────────────────────────────────────

  const kpiCard = (
    key: string,
    label: string,
    value: string,
    sub: string,
    accent: string,
    icon: React.ReactNode,
    index: number
  ) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest leading-tight"
           style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        <span className="p-2 rounded-lg shrink-0" style={{ background: `${accent}1F`, color: accent }}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-black leading-tight" style={{ color: 'var(--color-text)' }}>
        {value}
        <span className="text-xs font-bold ml-1" style={{ color: 'var(--color-text-dim)' }}>DA</span>
      </p>
      <p className="text-[11px] mt-1 font-semibold" style={{ color: 'var(--color-text-dim)' }}>{sub}</p>
    </motion.div>
  );

  return (
    <div className="space-y-7 pb-8">
      {/* ── En-tête + filtres ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-2))',
          border: '1px solid var(--color-vel-border-gold)',
          boxShadow: 'var(--shadow-lift)',
        }}
      >
        <span
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, var(--color-gold), transparent)' }}
        />
        <div className="relative p-8">
          <div className="flex items-center gap-4 mb-7">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--color-gold-light), var(--color-gold))',
                boxShadow: 'var(--shadow-gold)',
              }}
            >
              💰
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase" style={{ color: 'var(--color-text)' }}>
                {T('Bénéfices par voiture', 'أرباح كل سيارة')}
              </h1>
              <p className="text-sm mt-1 font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {T('Locations, dépenses et répartition des bénéfices',
                   'الإيجارات والمصاريف وتوزيع الأرباح')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label-saas">{T('Véhicule', 'المركبة')}</label>
              <select value={selectedCarId} onChange={e => setSelectedCarId(e.target.value)} className="input-saas">
                <option value="">{T('-- Choisir une voiture --', '-- اختر سيارة --')}</option>
                {cars.map(car => (
                  <option key={car.id} value={car.id}>
                    {car.brand} {car.model} ({car.registration})
                    {car.ownerType === 'third_party' ? ' — ' + T('tiers', 'طرف ثالث') : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-saas">{T('Date de début', 'تاريخ البداية')}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-saas" />
            </div>
            <div>
              <label className="label-saas">{T('Date de fin', 'تاريخ النهاية')}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-saas" />
            </div>
            <div className="flex items-end">
              <button onClick={handleGenerate} disabled={loading || !selectedCarId} className="btn-saas-primary w-full">
                {loading
                  ? <><Loader2 size={16} className="animate-spin" />{T('Génération...', 'جاري...')}</>
                  : <><TrendingUp size={16} />{T('Générer', 'إنشاء')}</>}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* État initial */}
        {!generated && !loading && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center justify-center py-24"
          >
            <div className="text-center max-w-md">
              <div className="text-7xl mb-4 opacity-25">📊</div>
              <p className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-soft)' }}>
                {T('Prêt à analyser vos bénéfices ?', 'هل أنت مستعد لتحليل أرباحك؟')}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
                {T('Sélectionnez un véhicule et une période, puis cliquez sur Générer.',
                   'اختر مركبة وفترة، ثم انقر على إنشاء.')}
              </p>
            </div>
          </motion.div>
        )}

        {generated && !loading && selectedCar && benefits && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* ── Fiche véhicule + propriétaire ────────────────────── */}
            <div className="rounded-2xl overflow-hidden card-gold">
              <div className="flex flex-col sm:flex-row items-center gap-5 p-6">
                <div
                  className="w-36 h-24 rounded-xl overflow-hidden shrink-0"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                >
                  <img
                    src={selectedCar.images?.[0] || 'https://picsum.photos/seed/car/400/300'}
                    alt={`${selectedCar.brand} ${selectedCar.model}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <h2 className="text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--color-text)' }}>
                    {selectedCar.brand} {selectedCar.model}
                  </h2>
                  <p className="font-bold text-sm" style={{ color: 'var(--color-gold)' }}>
                    {selectedCar.registration}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                    {[
                      `📅 ${selectedCar.year}`,
                      `⛽ ${selectedCar.energy}`,
                      `🎯 ${Number(selectedCar.mileage || 0).toLocaleString('fr-FR')} km`,
                    ].map(chip => (
                      <span
                        key={chip}
                        className="text-[11px] font-bold px-3 py-1 rounded-full"
                        style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-soft)' }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Badge propriétaire */}
                <div
                  className="rounded-xl px-4 py-3 text-center sm:text-left shrink-0"
                  style={{
                    background: benefits.isThirdParty ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
                    border: `1px solid ${benefits.isThirdParty ? 'var(--color-vel-border-gold)' : 'var(--color-border-soft)'}`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 justify-center sm:justify-start"
                     style={{ color: 'var(--color-text-muted)' }}>
                    {benefits.isThirdParty ? <Users size={12} /> : <Building2 size={12} />}
                    {T('Propriétaire', 'المالك')}
                  </p>
                  <p className="font-black text-sm mt-1"
                     style={{ color: benefits.isThirdParty ? 'var(--color-gold)' : 'var(--color-text)' }}>
                    {benefits.isThirdParty
                      ? (benefits.ownerName || T('Tiers', 'طرف ثالث'))
                      : T("Agence (personnelle)", 'الوكالة (شخصية)')}
                  </p>
                  {benefits.isThirdParty && (
                    <>
                      {benefits.ownerPhone && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {benefits.ownerPhone}
                        </p>
                      )}
                      <p className="text-[11px] mt-1 font-semibold" style={{ color: 'var(--color-text-dim)' }}>
                        {T('Part agence', 'حصة الوكالة')} : {fmt(benefits.agencyDailyShare)} DA/{T('jour', 'يوم')}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── KPI ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCard('inv', T('Total facturé', 'الإجمالي المفوتر'), fmt(benefits.totalInvoiced),
                `${benefits.rentalsCount} ${T('location(s)', 'إيجار')} · ${benefits.totalDays} ${T('jours', 'يوم')}`,
                'var(--color-act-edit)', <FileText size={16} />, 0)}
              {kpiCard('paid', T('Encaissé', 'المحصّل'), fmt(benefits.totalPaid),
                `${T('Reste dû', 'المتبقي')} : ${fmt(benefits.totalRemaining)} DA`,
                'var(--color-act-success)', <Wallet size={16} />, 1)}
              {kpiCard('exp', T('Dépenses', 'المصاريف'), fmt(benefits.totalExpenses),
                `${benefits.expenses.length} ${T('ligne(s)', 'بند')}`,
                'var(--color-act-delete)', <Receipt size={16} />, 2)}
              {kpiCard('net', T('Bénéfice net', 'صافي الربح'), fmt(benefits.netBenefit),
                benefits.netBenefit >= 0 ? T('Profit', 'ربح') : T('Perte', 'خسارة'),
                benefits.netBenefit >= 0 ? 'var(--color-gold)' : 'var(--color-act-warning)',
                <TrendingUp size={16} />, 3)}
            </div>

            {/* ── Répartition agence / propriétaire ────────────────── */}
            {benefits.isThirdParty && (
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-vel-border-gold)' }}
              >
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h3 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2"
                      style={{ color: 'var(--color-gold)' }}>
                    <Users size={16} />
                    {T('Répartition des bénéfices', 'توزيع الأرباح')}
                  </h3>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-dim)' }}>
                    {T(
                      `L'agence retient ${fmt(benefits.agencyDailyShare)} DA par jour loué. Les dépenses du véhicule sont déduites de la part du propriétaire.`,
                      `تحتفظ الوكالة بـ ${fmt(benefits.agencyDailyShare)} دج عن كل يوم إيجار. تُخصم مصاريف المركبة من حصة المالك.`
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x"
                     style={{ borderColor: 'var(--color-border)' }}>
                  <div className="p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                       style={{ color: 'var(--color-text-muted)' }}>
                      <Building2 size={12} /> {T("Part de l'agence", 'حصة الوكالة')}
                    </p>
                    <p className="text-3xl font-black mt-2" style={{ color: 'var(--color-gold)' }}>
                      {fmt(benefits.agencyBenefit)} <span className="text-sm">DA</span>
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-dim)' }}>
                      {benefits.totalDays} {T('jours', 'يوم')} × {fmt(benefits.agencyDailyShare)} DA
                    </p>
                  </div>

                  <div className="p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                       style={{ color: 'var(--color-text-muted)' }}>
                      <Users size={12} /> {T('Part du propriétaire', 'حصة المالك')}
                    </p>
                    <p className="text-3xl font-black mt-2"
                       style={{ color: benefits.ownerBenefit >= 0 ? 'var(--color-act-success)' : 'var(--color-act-delete)' }}>
                      {fmt(benefits.ownerBenefit)} <span className="text-sm">DA</span>
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-dim)' }}>
                      {fmt(benefits.totalPaid - benefits.agencyBenefit)} {T('encaissé', 'محصّل')} − {fmt(benefits.totalExpenses)} {T('dépenses', 'مصاريف')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Onglets locations / dépenses ─────────────────────── */}
            <div className="rounded-2xl overflow-hidden"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex" style={{ borderBottom: '1px solid var(--color-border)' }}>
                {([
                  { id: 'rentals',  label: `${T('Locations', 'الإيجارات')} (${benefits.lines.length})`,   icon: <Calendar size={15} /> },
                  { id: 'expenses', label: `${T('Dépenses', 'المصاريف')} (${benefits.expenses.length})`, icon: <Receipt size={15} /> },
                ] as const).map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className="relative flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    style={{ color: tab === id ? 'var(--color-gold)' : 'var(--color-text-muted)' }}
                  >
                    {icon}{label}
                    {tab === id && (
                      <motion.span
                        layoutId="gains-tab"
                        className="absolute inset-x-0 bottom-0 h-0.5"
                        style={{ background: 'var(--color-gold)' }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Locations */}
              {tab === 'rentals' && (
                <div>
                  {benefits.lines.length === 0 ? (
                    <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-dim)' }}>
                      {T('Aucune location sur cette période.', 'لا توجد إيجارات في هذه الفترة.')}
                    </p>
                  ) : benefits.lines.map(line => {
                    const open = expandedRes === line.id;
                    return (
                      <div key={line.id} style={{ borderTop: '1px solid var(--color-border-soft)' }}>
                        <button
                          onClick={() => setExpandedRes(open ? null : line.id)}
                          className="w-full text-left px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate" style={{ color: 'var(--color-text)' }}>
                              {line.clientName}
                            </p>
                            <p className="text-xs flex items-center gap-2 mt-1" style={{ color: 'var(--color-text-muted)' }}>
                              <Clock size={13} />
                              {fmtD(line.departureDate)} → {fmtD(line.returnDate)}
                              <span className="font-bold">({line.days} {T('j', 'ي')})</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black" style={{ color: 'var(--color-act-success)' }}>
                              {fmt(line.paid)} DA
                            </p>
                            {line.remaining > 0 && (
                              <p className="text-xs font-bold" style={{ color: 'var(--color-act-warning)' }}>
                                {T('reste', 'متبقي')} {fmt(line.remaining)}
                              </p>
                            )}
                          </div>
                          <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ color: 'var(--color-text-dim)' }}>
                            <ChevronDown size={18} />
                          </motion.span>
                        </button>

                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                              style={{ background: 'var(--color-bg)' }}
                            >
                              <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                  [T('Total', 'الإجمالي'), fmt(line.total), 'var(--color-text)'],
                                  [T('Encaissé', 'المحصّل'), fmt(line.paid), 'var(--color-act-success)'],
                                  [T('Reste', 'المتبقي'), fmt(line.remaining),
                                   line.remaining > 0 ? 'var(--color-act-warning)' : 'var(--color-text-muted)'],
                                  ...(benefits.isThirdParty
                                    ? [
                                        [T('Part agence', 'حصة الوكالة'), fmt(line.agencyShare), 'var(--color-gold)'] as const,
                                        [T('Part propriétaire', 'حصة المالك'), fmt(line.ownerShare), 'var(--color-act-success)'] as const,
                                      ]
                                    : []),
                                ].map(([label, value, color], i) => (
                                  <div key={i} className="rounded-lg p-3"
                                       style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-soft)' }}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide"
                                       style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                                    <p className="font-black mt-1" style={{ color: color as string }}>{value} DA</p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dépenses */}
              {tab === 'expenses' && (
                <div>
                  {benefits.expenses.length === 0 ? (
                    <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-dim)' }}>
                      {T('Aucune dépense sur cette période.', 'لا توجد مصاريف في هذه الفترة.')}
                    </p>
                  ) : benefits.expenses.map(exp => {
                    const open = expandedExp === exp.id;
                    return (
                      <div key={exp.id} style={{ borderTop: '1px solid var(--color-border-soft)' }}>
                        <button
                          onClick={() => setExpandedExp(open ? null : exp.id)}
                          className="w-full text-left px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate" style={{ color: 'var(--color-text)' }}>
                              {exp.expenseName || String(exp.type).toUpperCase()}
                            </p>
                            <p className="text-xs flex items-center gap-2 mt-1" style={{ color: 'var(--color-text-muted)' }}>
                              <Calendar size={13} /> {fmtD(exp.date)}
                            </p>
                          </div>
                          <p className="font-black shrink-0" style={{ color: 'var(--color-act-delete)' }}>
                            − {fmt(Number(exp.cost) || 0)} DA
                          </p>
                          <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ color: 'var(--color-text-dim)' }}>
                            <ChevronDown size={18} />
                          </motion.span>
                        </button>

                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                              style={{ background: 'var(--color-bg)' }}
                            >
                              <div className="px-6 py-4 space-y-2 text-sm">
                                {[
                                  [T('Type', 'النوع'), String(exp.type)],
                                  [T('Montant', 'المبلغ'), `${fmt(Number(exp.cost) || 0)} DA`],
                                  ...(exp.note ? [[T('Note', 'ملاحظة'), exp.note]] : []),
                                  ...(exp.currentMileage ? [[T('Kilométrage', 'المسافة'), `${exp.currentMileage} km`]] : []),
                                ].map(([k, v], i) => (
                                  <div key={i} className="flex justify-between gap-4">
                                    <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                                    <span className="font-semibold text-right" style={{ color: 'var(--color-text)' }}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {benefits.lines.length === 0 && benefits.expenses.length === 0 && (
              <div className="rounded-2xl p-8 text-center"
                   style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}>
                <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-dim)' }} />
                <p className="font-semibold" style={{ color: 'var(--color-text-soft)' }}>
                  {T('Aucune donnée pour cette période', 'لا توجد بيانات لهذه الفترة')}
                </p>
              </div>
            )}

            {/* ── Impression ───────────────────────────────────────── */}
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              <button onClick={handlePrintFull} className="btn-act-print px-8">
                <Printer size={18} />
                {T('Rapport interne complet', 'التقرير الداخلي الكامل')}
              </button>

              {benefits.isThirdParty && (
                <div className="flex flex-col items-center gap-1.5">
                  <button onClick={handlePrintOwner} className="btn-saas-primary px-8">
                    <FileText size={18} />
                    {T('Rapport propriétaire', 'تقرير المالك')}
                  </button>
                  <p className="text-[11px] text-center max-w-xs" style={{ color: 'var(--color-text-dim)' }}>
                    {T("Ne mentionne pas la part de l'agence.", 'لا يذكر حصة الوكالة.')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CarGainsPage;
