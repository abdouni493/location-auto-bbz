import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardStats, MaintenanceAlert, Language, Car, ReservationDetails, VehicleExpense, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, Shield, FileCheck, AlertCircle, ArrowUpRight,
  Users, KeyRound, CarFront, Wrench, TrendingUp, Bell,
  CalendarPlus, PlusCircle, BarChart3, ListFilter,
} from 'lucide-react';
import { DatabaseService } from '../services/DatabaseService';
import { getCars } from '../services/carService';
import { getVehicleExpenses } from '../services/expenseService';
import { getVidangeAlert, getAssuranceAlert, getControleAlert, getChaineAlert } from '../utils/vidangeAlerts';
import { ReservationsService } from '../services/ReservationsService';
import { getReservationAlerts } from '../utils/reservationAlerts';
import { ReservationAlertCard } from './ReservationAlertCard';
import { scheduleNotification, checkAndTriggerScheduledNotifications, requestNotificationPermission } from '../services/notificationService';

// Mock data for dashboard (removed - now using real data)

interface DashboardPageProps {
  lang: Language;
  isAuthLoading?: boolean;
  user?: User | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ lang, isAuthLoading = false, user = null }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalReservations: 0,
    activeReservations: 0,
    totalClients: 0,
    totalCars: 0,
    availableCars: 0,
    maintenanceAlerts: 0,
    overduePayments: 0,
    recentReservations: [],
    revenueByMonth: [],
    carUtilization: []
  });
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  const [showOnlyReservationAlerts, setShowOnlyReservationAlerts] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'all' | 'maintenance' | 'reservations'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip loading if authentication is still in progress or user not available
    if (isAuthLoading) return;
    if (!user) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch real data from database in parallel
        const [dbStats, dbAlerts, carsResult, expensesResult, reservationsResult] = await Promise.all([
          DatabaseService.getDashboardStats(),
          DatabaseService.getMaintenanceAlerts(),
          getCars(),
          getVehicleExpenses(),
          ReservationsService.getReservations()
        ]);

        // Set cars and expenses for vidange alerts
        if (carsResult.success && carsResult.cars) {
          setCars(carsResult.cars.map(dbCar => ({
            id: dbCar.id || '',
            brand: dbCar.brand,
            model: dbCar.model,
            registration: dbCar.plate_number,
            year: dbCar.year,
            color: dbCar.color || 'Premium',
            vin: dbCar.vin || '',
            energy: dbCar.energy || 'Essence',
            transmission: dbCar.transmission || 'Automatique',
            seats: dbCar.seats || 5,
            doors: dbCar.doors || 4,
            priceDay: Math.round(Number(dbCar.price_per_day)),
            priceWeek: Math.round(Number(dbCar.price_week || dbCar.price_per_day * 2)),
            priceMonth: Math.round(Number(dbCar.price_month || dbCar.price_per_day * 4)),
            deposit: Math.round(Number(dbCar.deposit || dbCar.price_per_day * 2)),
            images: dbCar.image_url ? [dbCar.image_url] : ['https://picsum.photos/seed/car/400/300'],
            mileage: dbCar.mileage || 0,
          })));
        }

        if (expensesResult.success && expensesResult.expenses) {
          setVehicleExpenses(expensesResult.expenses);
        }

        // Set reservations for alerts
        if (Array.isArray(reservationsResult)) {
          setReservations(reservationsResult);
        }

        // Map database stats to component state
        setStats({
          totalRevenue: dbStats.totalRevenue,
          totalExpenses: dbStats.totalExpenses,
          netProfit: dbStats.netProfit,
          totalClients: dbStats.totalClients,
          totalCars: dbStats.totalCars,
          activeReservations: dbStats.activeReservations,
          maintenanceAlerts: dbStats.maintenanceAlerts,
          // Use actual data from database
          monthlyRevenue: dbStats.monthlyRevenue || 0,
          totalReservations: dbStats.totalReservations || 0,
          availableCars: dbStats.availableCars || 0,
          overduePayments: dbStats.overduePayments || 0,
          recentReservations: dbStats.recentReservations || [],
          revenueByMonth: dbStats.revenueByMonth || [],
          carUtilization: dbStats.carUtilization || []
        });

        setAlerts(dbAlerts);

        setLoading(false);
      } catch (err: any) {
        console.error('Error loading dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
        setLoading(false);
      }
    };

    loadDashboardData();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [user, isAuthLoading]);

  // Schedule notifications for reservations expiring tomorrow
  useEffect(() => {
    if (reservations.length === 0) return;

    // Request notification permission on first load
    requestNotificationPermission();

    // Get all alerts to find expiring_tomorrow alerts
    const allAlerts = getReservationAlerts(reservations);
    const expiringTomorrowAlerts = allAlerts.filter(a => a.type === 'expiring_tomorrow');

    // Schedule notifications for each expiring reservation
    expiringTomorrowAlerts.forEach(alert => {
      const returnDate = new Date(alert.reservation.step1.returnDate);
      const clientName = `${alert.reservation.client.firstName} ${alert.reservation.client.lastName}`;
      const vehicleName = `${alert.reservation.car.brand} ${alert.reservation.car.model}`;
      const message = `La réservation de ${clientName} pour ${vehicleName} expire demain!`;
      
      scheduleNotification(alert.reservationId, returnDate, message);
    });

    console.log(`[Dashboard] Scheduled ${expiringTomorrowAlerts.length} notification(s) for expiring reservations`);
  }, [reservations]);

  // Check and trigger scheduled notifications every minute
  useEffect(() => {
    const notificationCheckInterval = setInterval(() => {
      checkAndTriggerScheduledNotifications();
    }, 60000); // Check every minute

    // Check immediately on mount
    checkAndTriggerScheduledNotifications();

    return () => clearInterval(notificationCheckInterval);
  }, []);

  // Commandes du site public en attente d'acceptation par l'agence
  // (statut dédié 'website_reservation', avant acceptation).
  const pendingWebOrdersCount = reservations.filter(
    r => r.source === 'website' && r.status === 'website_reservation'
  ).length;

  /** Nombre d'alertes encore ouvertes, tous types de maintenance confondus. */
  const openMaintenanceCount = cars.reduce((total, car) => {
    const perCar = [
      getVidangeAlert(car, vehicleExpenses),
      getAssuranceAlert(car, vehicleExpenses),
      getControleAlert(car, vehicleExpenses),
      getChaineAlert(car, vehicleExpenses),
    ].filter(a => a !== null && a.status !== 'ok');
    return total + perCar.length;
  }, 0);

  const openReservationCount = getReservationAlerts(reservations).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-5">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-11 h-11 rounded-full"
          style={{
            border: '3px solid var(--color-border-soft)',
            borderTopColor: 'var(--color-gold)',
          }}
        />
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'fr' ? 'Chargement du tableau de bord…' : 'جاري تحميل لوحة القيادة…'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div
          className="text-center rounded-2xl px-10 py-12 max-w-md"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <span
            className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{
              background: 'color-mix(in srgb, var(--color-act-delete) 14%, transparent)',
              color: 'var(--color-act-delete)',
            }}
          >
            <AlertTriangle size={26} />
          </span>
          <h3 className="font-display text-xl font-black tracking-tight mb-2" style={{ color: 'var(--color-text)' }}>
            {lang === 'fr' ? 'Erreur de chargement' : 'خطأ في التحميل'}
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ══ EN-TÊTE ═══════════════════════════════════════════════════════════ */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl p-7 sm:p-9"
        style={{
          background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-2))',
          border: '1px solid var(--color-vel-border-gold)',
          boxShadow: 'var(--shadow-lift)',
        }}
      >
        {/* Liseré doré supérieur */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--color-gold), transparent)' }}
        />
        {/* Halo discret */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full"
          style={{ background: 'var(--color-gold-glow)', filter: 'blur(80px)', opacity: 0.5 }}
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-7">
          <div className="space-y-2 min-w-0">
            <motion.h1
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.4 }}
              className="font-display text-3xl sm:text-4xl font-black tracking-tighter uppercase flex items-center gap-4"
              style={{ color: 'var(--color-text)' }}
            >
              <span
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--color-gold-light), var(--color-gold))',
                  boxShadow: 'var(--shadow-gold)',
                  color: '#0A0A0B',
                }}
              >
                <BarChart3 size={26} />
              </span>
              {lang === 'fr' ? 'Tableau de Bord' : 'لوحة القيادة'}
            </motion.h1>

            <motion.p
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.16, duration: 0.4 }}
              className="font-bold text-[11px] uppercase tracking-[0.3em]"
              style={{ color: 'var(--color-gold)' }}
            >
              {lang === 'fr' ? "Vue d'ensemble de l'activité" : 'نظرة عامة على النشاط'}
            </motion.p>

            <motion.p
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.24, duration: 0.4 }}
              className="text-sm font-medium pt-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {currentTime.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </motion.p>
          </div>

          {/* Chiffre d'affaires mis en avant */}
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.28, type: 'spring', stiffness: 260, damping: 26 }}
            className="rounded-2xl px-7 py-5 shrink-0"
            style={{
              background: 'var(--color-gold-soft)',
              border: '1px solid var(--color-vel-border-gold)',
            }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <TrendingUp size={12} />
              {lang === 'fr' ? 'Revenus du mois' : 'إيرادات الشهر'}
            </p>
            <p className="font-display text-3xl font-black mt-1.5 leading-none" style={{ color: 'var(--color-gold)' }}>
              {Math.round(stats.monthlyRevenue || 0).toLocaleString('fr-FR')}
              <span className="text-sm ml-1.5">DA</span>
            </p>
            <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-dim)' }}>
              {lang === 'fr' ? 'Total encaissé' : 'الإجمالي المحصّل'}{' : '}
              {Math.round(stats.totalRevenue || 0).toLocaleString('fr-FR')} DA
            </p>
          </motion.div>
        </div>
      </motion.header>

      {/* ══ INDICATEURS CLÉS ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {([
          {
            key: 'clients',
            label: { fr: 'Clients', ar: 'العملاء' },
            value: String(stats.totalClients),
            hint: { fr: 'Total enregistrés', ar: 'إجمالي المسجلين' },
            accent: 'var(--color-act-edit)',
            Icon: Users,
            to: '/clients',
          },
          {
            key: 'active',
            label: { fr: 'Locations en cours', ar: 'الإيجارات الجارية' },
            value: String(stats.activeReservations),
            hint: { fr: `${stats.totalReservations} au total`, ar: `${stats.totalReservations} إجمالاً` },
            accent: 'var(--color-act-success)',
            Icon: KeyRound,
            to: '/reservations',
          },
          {
            key: 'fleet',
            label: { fr: 'Véhicules disponibles', ar: 'المركبات المتاحة' },
            value: `${stats.availableCars}/${stats.totalCars}`,
            hint: {
              fr: stats.totalCars > 0 ? `${Math.round((stats.availableCars / stats.totalCars) * 100)} % de la flotte` : '—',
              ar: stats.totalCars > 0 ? `${Math.round((stats.availableCars / stats.totalCars) * 100)} % من الأسطول` : '—',
            },
            accent: 'var(--color-gold)',
            Icon: CarFront,
            to: '/vehicules',
            ratio: stats.totalCars > 0 ? stats.availableCars / stats.totalCars : 0,
          },
          {
            key: 'alerts',
            label: { fr: 'Alertes maintenance', ar: 'تنبيهات الصيانة' },
            value: String(openMaintenanceCount),
            hint: {
              fr: openMaintenanceCount > 0 ? 'À traiter' : 'Rien à signaler',
              ar: openMaintenanceCount > 0 ? 'للمعالجة' : 'لا شيء',
            },
            accent: openMaintenanceCount > 0 ? 'var(--color-act-warning)' : 'var(--color-act-success)',
            Icon: Wrench,
            to: '/maintenance',
          },
        ]).map((kpi, i) => (
          <motion.button
            key={kpi.key}
            type="button"
            onClick={() => navigate(kpi.to)}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.985 }}
            className="group relative overflow-hidden rounded-2xl p-5 text-left cursor-pointer"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            {/* Filet d'accent en haut de carte */}
            <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: kpi.accent }} />
            {/* Halo au survol */}
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -right-10 w-40 h-40 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: `color-mix(in srgb, ${kpi.accent} 22%, transparent)`, filter: 'blur(50px)' }}
            />

            <div className="relative flex items-start justify-between gap-3 mb-4">
              <p
                className="text-[10px] font-black uppercase tracking-widest leading-tight pt-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {kpi.label[lang]}
              </p>
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: `color-mix(in srgb, ${kpi.accent} 14%, transparent)`,
                  color: kpi.accent,
                }}
              >
                <kpi.Icon size={19} />
              </span>
            </div>

            <p className="relative font-display text-[2.1rem] font-black leading-none" style={{ color: 'var(--color-text)' }}>
              {kpi.value}
            </p>

            {/* Jauge de disponibilité, uniquement là où un ratio a du sens */}
            {typeof kpi.ratio === 'number' && (
              <span
                className="relative mt-3 block h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--color-surface-3)' }}
              >
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: kpi.accent }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(kpi.ratio * 100)}%` }}
                  transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            )}

            <p className="relative text-[11px] mt-2 font-semibold flex items-center gap-1" style={{ color: 'var(--color-text-dim)' }}>
              {kpi.hint[lang]}
              <ArrowUpRight
                size={12}
                className="opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
              />
            </p>
          </motion.button>
        ))}
      </div>

      {/* ══ COMMANDES DU SITE EN ATTENTE ══════════════════════════════════════ */}
      <AnimatePresence>
        {pendingWebOrdersCount > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => navigate('/website-commandes')}
            className="group relative w-full flex items-center gap-4 sm:gap-5 overflow-hidden rounded-2xl px-5 sm:px-6 py-5 text-left cursor-pointer"
            style={{
              background: 'linear-gradient(120deg, var(--color-surface), var(--color-surface-2))',
              border: '1px solid var(--color-vel-border-gold)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            {/* Reflet doré qui balaie la carte */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg]"
              style={{ background: 'var(--color-gold-soft)' }}
              animate={{ x: ['0%', '500%'] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
            />

            {/* Cloche + pastille du nombre */}
            <span className="relative flex-shrink-0">
              <motion.span
                aria-hidden
                className="absolute -inset-1.5 rounded-2xl"
                style={{ background: 'var(--color-gold-glow)' }}
                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, var(--color-gold-light), var(--color-gold))',
                  color: '#0A0A0B',
                  boxShadow: 'var(--shadow-gold)',
                }}
              >
                <Bell size={22} />
              </motion.span>
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[24px] h-6 px-1.5 flex items-center justify-center text-white text-xs font-black rounded-full"
                style={{ background: 'var(--color-act-delete)', boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }}
              >
                {pendingWebOrdersCount > 99 ? '99+' : pendingWebOrdersCount}
              </span>
            </span>

            <div className="relative flex-1 min-w-0">
              <p className="font-display font-black text-base sm:text-lg uppercase tracking-tight" style={{ color: 'var(--color-text)' }}>
                {lang === 'fr'
                  ? `${pendingWebOrdersCount} nouvelle${pendingWebOrdersCount > 1 ? 's' : ''} commande${pendingWebOrdersCount > 1 ? 's' : ''} du site web`
                  : `${pendingWebOrdersCount} طلب جديد من الموقع`}
              </p>
              <p className="text-xs sm:text-sm font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {lang === 'fr'
                  ? 'En attente de votre acceptation — cliquez pour les traiter'
                  : 'في انتظار موافقتك — انقر لمعالجتها'}
              </p>
            </div>

            <span
              className="relative hidden sm:flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl text-sm whitespace-nowrap transition-transform group-hover:translate-x-1"
              style={{
                background: 'linear-gradient(135deg, var(--color-gold-light), var(--color-gold))',
                color: '#0A0A0B',
              }}
            >
              {lang === 'fr' ? 'Traiter' : 'معالجة'}
              <ArrowUpRight size={16} />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ══ FILTRE DES ALERTES ════════════════════════════════════════════════ */}
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl p-4"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <h3
          className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ListFilter size={14} style={{ color: 'var(--color-gold)' }} />
          {lang === 'fr' ? 'Filtrer les alertes' : 'تصفية التنبيهات'}
        </h3>

        <div
          className="flex flex-wrap gap-1 p-1 rounded-xl"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }}
        >
          {([
            { key: 'all',          fr: 'Toutes',       ar: 'الجميع',   count: openMaintenanceCount + openReservationCount },
            { key: 'maintenance',  fr: 'Maintenance',  ar: 'الصيانة',  count: openMaintenanceCount },
            { key: 'reservations', fr: 'Réservations', ar: 'الحجوزات', count: openReservationCount },
          ] as const).map(opt => {
            const active = alertFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setAlertFilter(opt.key)}
                className="relative px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 cursor-pointer transition-colors"
                style={{ color: active ? '#0A0A0B' : 'var(--color-text-muted)' }}
              >
                {/* Pastille active animée d'un onglet à l'autre */}
                {active && (
                  <motion.span
                    layoutId="dashboard-alert-filter"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'linear-gradient(135deg, var(--color-gold-light), var(--color-gold))' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{lang === 'fr' ? opt.fr : opt.ar}</span>
                <span
                  className="relative min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-black"
                  style={{
                    background: active ? 'rgba(10,10,11,0.14)' : 'var(--color-surface-3)',
                    color: active ? '#0A0A0B' : 'var(--color-text-dim)',
                  }}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vidange Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'maintenance') && (
      <div
        className="relative"
      >
        {(() => {
          const vidangeAlerts = cars
            .map(car => ({
              car,
              alert: getVidangeAlert(car, vehicleExpenses)
            }))
            .filter(item => item.alert !== null && item.alert.status !== 'ok');

          if (vidangeAlerts.length === 0) return null;

          const overdueAlerts = vidangeAlerts.filter(item => item.alert?.status === 'overdue');
          const warningAlerts = vidangeAlerts.filter(item => item.alert?.status === 'warning');

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      overdueAlerts.length > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-amber-500 to-amber-600'
                    }`}>
                      <span className="text-2xl">🛢️</span>
                    </div>
                    {(overdueAlerts.length > 0 || warningAlerts.length > 0) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                      {lang === 'fr' ? 'Alertes Vidange' : 'تنبيهات الصيانة'}
                    </h2>
                    <p className="text-saas-text-muted font-medium">
                      {overdueAlerts.length} {lang === 'fr' ? 'en retard' : 'متأخرة'}, {warningAlerts.length} {lang === 'fr' ? 'avertissements' : 'تحذيرات'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vidangeAlerts.map((item, index) => {
                  const { car, alert } = item;
                  if (!alert) return null;

                  return (
                    <motion.div
                      key={car.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => {
                        navigate('/maintenance', {
                          state: {
                            selectedCarId: car.id,
                            expenseType: 'vidange',
                            showExpenseModal: true
                          }
                        });
                      }}
                      className={`p-5 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all ${
                        alert.status === 'overdue'
                          ? 'bg-red-50 border-red-300 hover:shadow-red-200'
                          : alert.status === 'warning'
                          ? 'bg-amber-50 border-amber-300 hover:shadow-amber-200'
                          : 'bg-green-50 border-green-300 hover:shadow-green-200'
                      } shadow-lg hover:shadow-2xl`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase tracking-tight ${
                            alert.status === 'overdue'
                              ? 'text-red-700'
                              : alert.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}>
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{car.registration}</p>
                        </div>
                        <AlertCircle className={`flex-shrink-0 ${
                          alert.status === 'overdue'
                            ? 'text-red-600'
                            : alert.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`} size={20} />
                      </div>
                      <p className={`text-xs font-bold ${
                        alert.status === 'overdue'
                          ? 'text-red-600'
                          : alert.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-600 border-t pt-2">
                        Kilométrage: {alert.currentMileage.toLocaleString()} / {alert.nextVidangeKm.toLocaleString()} KM
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Assurance Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'maintenance') && (
      <div className="relative">
        {(() => {
          const assuranceAlerts = cars
            .map(car => ({
              car,
              alert: getAssuranceAlert(car, vehicleExpenses)
            }))
            .filter(item => item.alert !== null && item.alert.status !== 'ok');

          if (assuranceAlerts.length === 0) return null;

          const expiredAlerts = assuranceAlerts.filter(item => item.alert?.status === 'overdue');
          const warningAlerts = assuranceAlerts.filter(item => item.alert?.status === 'warning');
          const okAlerts = assuranceAlerts.filter(item => item.alert?.status === 'ok');

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      expiredAlerts.length > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}>
                      <span className="text-2xl">🛡️</span>
                    </div>
                    {(expiredAlerts.length > 0 || warningAlerts.length > 0) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                      {lang === 'fr' ? 'Alertes Assurance' : 'تنبيهات التأمين'}
                    </h2>
                    <p className="text-saas-text-muted font-medium">
                      {expiredAlerts.length} {lang === 'fr' ? 'expirées' : 'منتهية الصلاحية'}, {warningAlerts.length} {lang === 'fr' ? 'avertissements' : 'تحذيرات'}, {okAlerts.length} {lang === 'fr' ? 'valides' : 'صحيحة'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assuranceAlerts.map((item, index) => {
                  const { car, alert } = item;
                  if (!alert) return null;

                  return (
                    <motion.div
                      key={car.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => {
                        navigate('/maintenance', {
                          state: {
                            selectedCarId: car.id,
                            expenseType: 'assurance',
                            showExpenseModal: true
                          }
                        });
                      }}
                      className={`p-5 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all ${
                        alert.status === 'overdue'
                          ? 'bg-red-50 border-red-300 hover:shadow-red-200'
                          : alert.status === 'warning'
                          ? 'bg-amber-50 border-amber-300 hover:shadow-amber-200'
                          : 'bg-green-50 border-green-300 hover:shadow-green-200'
                      } shadow-lg hover:shadow-2xl`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase tracking-tight ${
                            alert.status === 'overdue'
                              ? 'text-red-700'
                              : alert.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}>
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{car.registration}</p>
                        </div>
                        <Shield className={`flex-shrink-0 ${
                          alert.status === 'overdue'
                            ? 'text-red-600'
                            : alert.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`} size={20} />
                      </div>
                      <p className={`text-xs font-bold ${
                        alert.status === 'overdue'
                          ? 'text-red-600'
                          : alert.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {alert.message}
                      </p>
                      <div className="text-xs text-gray-600 border-t pt-2 space-y-1">
                        <p>
                          {lang === 'fr' ? 'Expiration:' : 'الانتهاء:'} {alert.expirationDate ? new Date(alert.expirationDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-SA') : 'N/A'}
                        </p>
                        <p>
                          {(alert.daysRemaining ?? 0) >= 0
                            ? `${lang === 'fr' ? 'Jours restants:' : 'الأيام المتبقية:'} ${alert.daysRemaining}`
                            : `${lang === 'fr' ? 'Jours expirés:' : 'الأيام المنتهية:'} ${Math.abs(alert.daysRemaining ?? 0)}`
                          }
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Controle Technique Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'maintenance') && (
      <div className="relative">
        {(() => {
          const controleAlerts = cars
            .map(car => ({
              car,
              alert: getControleAlert(car, vehicleExpenses)
            }))
            .filter(item => item.alert !== null && item.alert.status !== 'ok');

          if (controleAlerts.length === 0) return null;

          const expiredAlerts = controleAlerts.filter(item => item.alert?.status === 'overdue');
          const warningAlerts = controleAlerts.filter(item => item.alert?.status === 'warning');
          const okAlerts = controleAlerts.filter(item => item.alert?.status === 'ok');

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      expiredAlerts.length > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-purple-500 to-purple-600'
                    }`}>
                      <span className="text-2xl">🔍</span>
                    </div>
                    {(expiredAlerts.length > 0 || warningAlerts.length > 0) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                      {lang === 'fr' ? 'Alertes Contrôle Technique' : 'تنبيهات الفحص الفني'}
                    </h2>
                    <p className="text-saas-text-muted font-medium">
                      {expiredAlerts.length} {lang === 'fr' ? 'expirées' : 'منتهية الصلاحية'}, {warningAlerts.length} {lang === 'fr' ? 'avertissements' : 'تحذيرات'}, {okAlerts.length} {lang === 'fr' ? 'valides' : 'صحيحة'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {controleAlerts.map((item, index) => {
                  const { car, alert } = item;
                  if (!alert) return null;

                  return (
                    <motion.div
                      key={car.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => {
                        navigate('/maintenance', {
                          state: {
                            selectedCarId: car.id,
                            expenseType: 'controle',
                            showExpenseModal: true
                          }
                        });
                      }}
                      className={`p-5 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all ${
                        alert.status === 'overdue'
                          ? 'bg-red-50 border-red-300 hover:shadow-red-200'
                          : alert.status === 'warning'
                          ? 'bg-amber-50 border-amber-300 hover:shadow-amber-200'
                          : 'bg-green-50 border-green-300 hover:shadow-green-200'
                      } shadow-lg hover:shadow-2xl`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase tracking-tight ${
                            alert.status === 'overdue'
                              ? 'text-red-700'
                              : alert.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}>
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{car.registration}</p>
                        </div>
                        <FileCheck className={`flex-shrink-0 ${
                          alert.status === 'overdue'
                            ? 'text-red-600'
                            : alert.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`} size={20} />
                      </div>
                      <p className={`text-xs font-bold ${
                        alert.status === 'overdue'
                          ? 'text-red-600'
                          : alert.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {alert.message}
                      </p>
                      <div className="text-xs text-gray-600 border-t pt-2 space-y-1">
                        <p>
                          {lang === 'fr' ? 'Expiration:' : 'الانتهاء:'} {alert.expirationDate ? new Date(alert.expirationDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-SA') : 'N/A'}
                        </p>
                        <p>
                          {(alert.daysRemaining ?? 0) >= 0
                            ? `${lang === 'fr' ? 'Jours restants:' : 'الأيام المتبقية:'} ${alert.daysRemaining}`
                            : `${lang === 'fr' ? 'Jours expirés:' : 'الأيام المنتهية:'} ${Math.abs(alert.daysRemaining ?? 0)}`
                          }
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Chaîne (Chain/Belt) Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'maintenance') && (
      <div className="relative">
        {(() => {
          const chaineAlerts = cars
            .map(car => ({
              car,
              alert: getChaineAlert(car, vehicleExpenses)
            }))
            .filter(item => item.alert !== null && item.alert.status !== 'ok');

          if (chaineAlerts.length === 0) return null;

          const overdueAlerts = chaineAlerts.filter(item => item.alert?.status === 'overdue');
          const warningAlerts = chaineAlerts.filter(item => item.alert?.status === 'warning');

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      overdueAlerts.length > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-orange-500 to-orange-600'
                    }`}>
                      <span className="text-2xl">⛓️</span>
                    </div>
                    {(overdueAlerts.length > 0 || warningAlerts.length > 0) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                      {lang === 'fr' ? 'Alertes Chaîne / Courroie' : 'تنبيهات السلسلة / التيمي'}
                    </h2>
                    <p className="text-saas-text-muted font-medium">
                      {overdueAlerts.length} {lang === 'fr' ? 'en retard' : 'متأخرة'}, {warningAlerts.length} {lang === 'fr' ? 'avertissements' : 'تحذيرات'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chaineAlerts.map((item, index) => {
                  const { car, alert } = item;
                  if (!alert) return null;

                  return (
                    <motion.div
                      key={car.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => {
                        navigate('/maintenance', {
                          state: {
                            selectedCarId: car.id,
                            expenseType: 'chaine',
                            showExpenseModal: true
                          }
                        });
                      }}
                      className={`p-5 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all ${
                        alert.status === 'overdue'
                          ? 'bg-red-50 border-red-300 hover:shadow-red-200'
                          : alert.status === 'warning'
                          ? 'bg-amber-50 border-amber-300 hover:shadow-amber-200'
                          : 'bg-green-50 border-green-300 hover:shadow-green-200'
                      } shadow-lg hover:shadow-2xl`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase tracking-tight ${
                            alert.status === 'overdue'
                              ? 'text-red-700'
                              : alert.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}>
                            {car.brand} {car.model}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{car.registration}</p>
                        </div>
                        <span className="text-xl flex-shrink-0">⛓️</span>
                      </div>
                      <p className={`text-xs font-bold ${
                        alert.status === 'overdue'
                          ? 'text-red-600'
                          : alert.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-600 border-t pt-2">
                        {lang === 'fr' ? 'Kilométrage:' : 'الكيلومترات:'} {alert.currentMileage.toLocaleString()} / {alert.nextVidangeKm.toLocaleString()} KM
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Reservation Alerts Section */}
      {(alertFilter === 'all' || alertFilter === 'reservations') && reservations && reservations.length > 0 && (() => {
        const resAlerts = getReservationAlerts(reservations);
        
        if (resAlerts.length === 0) return null;

        const criticalResAlerts = resAlerts.filter(a => a.severity === 'critical');
        const highResAlerts = resAlerts.filter(a => a.severity === 'high');
        const mediumResAlerts = resAlerts.filter(a => a.severity === 'medium');

        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="relative"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                    criticalResAlerts.length > 0
                      ? 'bg-gradient-to-br from-red-600 to-rose-600'
                      : highResAlerts.length > 0
                      ? 'bg-gradient-to-br from-orange-500 to-red-600'
                      : 'bg-gradient-to-br from-yellow-500 to-orange-600'
                  }`}>
                    <span className="text-2xl">🚗</span>
                  </div>
                  {resAlerts.length > 0 && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-pulse shadow-lg"
                    />
                  )}
                </motion.div>
                <div>
                  <h2 className="text-2xl font-black text-saas-text-main uppercase tracking-tighter">
                    {lang === 'fr' ? 'Alertes Réservations' : 'تنبيهات الحجوزات'}
                  </h2>
                  <p className="text-saas-text-muted font-medium">
                    {criticalResAlerts.length} {lang === 'fr' ? 'critiques' : 'حرجة'}, {highResAlerts.length} {lang === 'fr' ? 'élevées' : 'عالية'}, {mediumResAlerts.length} {lang === 'fr' ? 'moyennes' : 'متوسطة'}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowOnlyReservationAlerts(!showOnlyReservationAlerts)}
                className={`px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wide transition-all ${
                  showOnlyReservationAlerts
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                }`}
              >
                {lang === 'fr' ? '+ Voir Alertes' : '+ عرض التنبيهات'}
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {resAlerts.map((alert, index) => (
                <ReservationAlertCard
                  key={alert.id}
                  alert={alert}
                  onAlertClick={(res) => {
                    console.log('[Reservation Alert] Clicked alert:', res.reservationId, res.id);
                    navigate('/planner', {
                      state: {
                        selectedReservationId: res.reservationId,
                        viewMode: 'details'
                      }
                    });
                  }}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* ══ GRAPHIQUES ════════════════════════════════════════════════════════
          L'en-tête et les indicateurs sont désormais en haut de page ; ici on
          garde les deux graphiques, redessinés au thème (tokens Obsidian Gold)
          pour suivre le mode clair / sombre. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Évolution des revenus ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl p-6 sm:p-7"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--color-act-edit)' }} />

          <div className="flex items-center gap-3 mb-6">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--color-act-edit) 14%, transparent)', color: 'var(--color-act-edit)' }}
            >
              <TrendingUp size={20} />
            </span>
            <div>
              <h3 className="font-display text-lg font-black uppercase tracking-tight" style={{ color: 'var(--color-text)' }}>
                {lang === 'fr' ? 'Évolution des Revenus' : 'تطور الإيرادات'}
              </h3>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-dim)' }}>
                {lang === 'fr' ? 'Sur les derniers mois' : 'خلال الأشهر الأخيرة'}
              </p>
            </div>
          </div>

          {stats.revenueByMonth.length === 0 ? (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--color-text-dim)' }}>
              {lang === 'fr' ? 'Aucune donnée de revenus pour le moment.' : 'لا توجد بيانات إيرادات حاليًا.'}
            </p>
          ) : (
            <div className="space-y-3.5">
              {stats.revenueByMonth.map((item, index) => {
                const max = Math.max(...stats.revenueByMonth.map(m => m.revenue), 1);
                const pct = (item.revenue / max) * 100;
                return (
                  <motion.div
                    key={item.month}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + index * 0.06 }}
                    className="flex items-center gap-4"
                  >
                    <span className="w-10 text-xs font-black uppercase" style={{ color: 'var(--color-text-muted)' }}>
                      {item.month}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.25 + index * 0.06, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, var(--color-act-edit), var(--color-act-view))' }}
                      />
                    </div>
                    <span className="w-24 text-right text-sm font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
                      {item.revenue.toLocaleString('fr-FR')}
                      <span className="text-[10px] font-bold ml-1" style={{ color: 'var(--color-text-dim)' }}>DA</span>
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Taux d'utilisation ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl p-6 sm:p-7"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--color-act-success)' }} />

          <div className="flex items-center gap-3 mb-6">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--color-act-success) 14%, transparent)', color: 'var(--color-act-success)' }}
            >
              <CarFront size={20} />
            </span>
            <div>
              <h3 className="font-display text-lg font-black uppercase tracking-tight" style={{ color: 'var(--color-text)' }}>
                {lang === 'fr' ? "Taux d'Utilisation" : 'معدلات الاستخدام'}
              </h3>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-dim)' }}>
                {lang === 'fr' ? 'Par véhicule' : 'لكل مركبة'}
              </p>
            </div>
          </div>

          {stats.carUtilization.length === 0 ? (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--color-text-dim)' }}>
              {lang === 'fr' ? 'Aucune donnée d’utilisation pour le moment.' : 'لا توجد بيانات استخدام حاليًا.'}
            </p>
          ) : (
            <div className="space-y-4">
              {stats.carUtilization.map((car, index) => {
                const tone = car.utilization > 80
                  ? 'var(--color-act-delete)'
                  : car.utilization > 60
                  ? 'var(--color-act-warning)'
                  : 'var(--color-act-success)';
                return (
                  <motion.div
                    key={car.carId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.06 }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold truncate" style={{ color: 'var(--color-text-soft)' }}>{car.carInfo}</span>
                      <span className="text-sm font-black tabular-nums ml-3 shrink-0" style={{ color: tone }}>{car.utilization}%</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${car.utilization}%` }}
                        transition={{ delay: 0.3 + index * 0.06, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{ background: tone }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ══ ACTIONS RAPIDES ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {([
          {
            key: 'reserve',
            Icon: CalendarPlus,
            accent: 'var(--color-act-edit)',
            title: { fr: 'Nouvelle Réservation', ar: 'حجز جديد' },
            desc: { fr: 'Créer une réservation pour un client', ar: 'إنشاء حجز لعميل' },
            cta: { fr: 'Créer', ar: 'إنشاء' },
            to: '/planificateur',
          },
          {
            key: 'car',
            Icon: PlusCircle,
            accent: 'var(--color-act-success)',
            title: { fr: 'Ajouter un Véhicule', ar: 'إضافة مركبة' },
            desc: { fr: 'Étendre votre flotte automobile', ar: 'توسيع أسطول السيارات' },
            cta: { fr: 'Ajouter', ar: 'إضافة' },
            to: '/vehicules',
          },
          {
            key: 'reports',
            Icon: BarChart3,
            accent: 'var(--color-act-print)',
            title: { fr: 'Rapports Détaillés', ar: 'تقارير مفصلة' },
            desc: { fr: 'Analyser performances et statistiques', ar: 'تحليل الأداء والإحصائيات' },
            cta: { fr: 'Voir', ar: 'عرض' },
            to: '/rapports',
          },
        ]).map((action, i) => (
          <motion.button
            key={action.key}
            type="button"
            onClick={() => navigate(action.to)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-3xl p-7 text-left cursor-pointer"
            style={{
              background: 'linear-gradient(150deg, var(--color-surface), var(--color-surface-2))',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-12 -right-8 w-36 h-36 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: `color-mix(in srgb, ${action.accent} 20%, transparent)`, filter: 'blur(48px)' }}
            />

            <span
              className="relative mb-5 w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `color-mix(in srgb, ${action.accent} 15%, transparent)`, color: action.accent }}
            >
              <action.Icon size={26} />
            </span>

            <h4 className="relative font-display text-lg font-black uppercase tracking-tight mb-1.5" style={{ color: 'var(--color-text)' }}>
              {action.title[lang]}
            </h4>
            <p className="relative text-sm leading-relaxed mb-5" style={{ color: 'var(--color-text-muted)' }}>
              {action.desc[lang]}
            </p>

            <span
              className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-transform group-hover:translate-x-1"
              style={{ background: `color-mix(in srgb, ${action.accent} 14%, transparent)`, color: action.accent }}
            >
              {action.cta[lang]}
              <ArrowUpRight size={16} />
            </span>
          </motion.button>
        ))}
      </div>

    </div>
  );
};