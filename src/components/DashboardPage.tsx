import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardStats, MaintenanceAlert, Language, Car, ReservationDetails, VehicleExpense, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, TrendingUp, Users, Car as CarIcon, Calendar, DollarSign, Wrench, Shield, FileCheck, Loader2, AlertCircle } from 'lucide-react';
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

interface AlertCardProps {
  alert: MaintenanceAlert;
  lang: Language;
  onAlertClick?: (alert: MaintenanceAlert) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, lang, onAlertClick }) => {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'low':
        return {
          bg: 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-800 dark:text-green-200',
          accent: 'bg-green-500',
          icon: '🟢',
          glow: 'shadow-green-500/20'
        };
      case 'medium':
        return {
          bg: 'bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-800 dark:text-yellow-200',
          accent: 'bg-yellow-500',
          icon: '🟡',
          glow: 'shadow-yellow-500/20'
        };
      case 'high':
        return {
          bg: 'bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-900/20 dark:to-red-900/20',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-800 dark:text-orange-200',
          accent: 'bg-orange-500',
          icon: '🟠',
          glow: 'shadow-orange-500/20'
        };
      case 'critical':
        return {
          bg: 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200',
          accent: 'bg-red-500',
          icon: '🔴',
          glow: 'shadow-red-500/20'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900/20 dark:to-slate-900/20',
          border: 'border-gray-200 dark:border-gray-800',
          text: 'text-gray-800 dark:text-gray-200',
          accent: 'bg-gray-500',
          icon: '⚪',
          glow: 'shadow-gray-500/20'
        };
    }
  };

  const styles = getSeverityStyles(alert.severity);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'vidange': return '🛢️';
      case 'assurance': return '🛡️';
      case 'controle': return '🔍';
      case 'chaine': return '⛓️';
      default: return '⚠️';
    }
  };

  const getProgressPercentage = () => {
    if ((alert.type === 'vidange' || alert.type === 'chaine') && alert.currentMileage !== undefined && alert.nextServiceMileage) {
      return Math.min(((alert.currentMileage || 0) / alert.nextServiceMileage) * 100, 100);
    }
    if (alert.dueDate) {
      const totalDays = alert.type === 'assurance' ? 365 : 180; // Approximate annual cycles
      const daysUntilDue = alert.daysUntilDue || 0;
      const daysSinceCreation = Math.max(0, totalDays - daysUntilDue);
      return Math.min((daysSinceCreation / totalDays) * 100, 100);
    }
    return 0;
  };

  const progressPercentage = getProgressPercentage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{
        scale: 1.03,
        boxShadow: `0 20px 40px -12px ${styles.glow}`,
        y: -2
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
      className={`relative overflow-hidden p-6 rounded-2xl border-2 ${styles.bg} ${styles.border} shadow-xl hover:shadow-2xl transition-all duration-500 backdrop-blur-sm`}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-current rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-current rounded-full translate-y-12 -translate-x-12"></div>
      </div>

      {/* Severity indicator stripe */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${styles.accent}`}></div>

      <div className="relative flex items-start gap-4">
        {/* Animated Icon */}
        <motion.div
          animate={{
            rotate: alert.severity === 'critical' ? [0, 10, -10, 0] : [0, 5, -5, 0],
            scale: alert.severity === 'critical' ? [1, 1.1, 1] : [1, 1.05, 1]
          }}
          transition={{
            duration: alert.severity === 'critical' ? 1.5 : 2,
            repeat: Infinity
          }}
          className="text-3xl flex-shrink-0 p-2 bg-white/20 rounded-xl backdrop-blur-sm"
        >
          {getAlertIcon(alert.type)}
        </motion.div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className={`font-bold text-lg uppercase tracking-tight ${styles.text}`}>
                {alert.title}
              </h4>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-lg"
              >
                {styles.icon}
              </motion.div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              alert.isExpired
                ? 'bg-red-500 text-white'
                : alert.severity === 'critical'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                : alert.severity === 'high'
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
            }`}>
              {alert.isExpired
                ? (lang === 'fr' ? 'EXPIRÉ' : 'منتهي الصلاحية')
                : alert.daysUntilDue !== undefined
                ? (lang === 'fr' ? `${alert.daysUntilDue} JOURS` : `${alert.daysUntilDue} أيام`)
                : (lang === 'fr' ? 'À VENIR' : 'قادم')
              }
            </div>
          </div>

          {/* Main Message */}
          <p className={`${styles.text} text-sm mb-4 leading-relaxed font-medium`}>
            {alert.message}
          </p>

          {/* Car Information */}
          <div className={`mb-4 p-3 rounded-xl bg-white/30 backdrop-blur-sm border border-white/20`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🚗</span>
              <span className={`font-semibold text-sm ${styles.text}`}>
                {alert.carInfo}
              </span>
            </div>

            {/* Mileage Progress for Vidange and Chaine */}
            {(alert.type === 'vidange' || alert.type === 'chaine') && alert.currentMileage !== undefined && alert.nextServiceMileage && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.text}>
                    {lang === 'fr' ? 'Kilométrage actuel:' : 'الكيلومترات الحالية:'}
                  </span>
                  <span className={`font-bold ${styles.text}`}>
                    {alert.currentMileage.toLocaleString()} km
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.text}>
                    {lang === 'fr' ? 'Prochaine vidange:' : 'الفيد الثاني:'}
                  </span>
                  <span className={`font-bold ${styles.text}`}>
                    {alert.nextServiceMileage.toLocaleString()} km
                  </span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={`h-full rounded-full ${styles.accent}`}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className={styles.text}>
                    {lang === 'fr' ? 'Progression:' : 'التقدم:'}
                  </span>
                  <span className={`font-bold ${styles.text}`}>
                    {progressPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Date Progress for Assurance/Controle */}
            {(alert.type === 'assurance' || alert.type === 'controle') && alert.dueDate && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.text}>
                    {lang === 'fr' ? 'Échéance:' : 'الموعد النهائي:'}
                  </span>
                  <span className={`font-bold ${styles.text}`}>
                    {new Date(alert.dueDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-SA')}
                  </span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={`h-full rounded-full ${styles.accent}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Additional Details */}
          <div className={`grid grid-cols-2 gap-2 text-xs ${styles.text}`}>
            <div className="flex justify-between">
              <span>{lang === 'fr' ? 'Type:' : 'النوع:'}</span>
              <span className="font-medium capitalize">{alert.type}</span>
            </div>
            <div className="flex justify-between">
              <span>{lang === 'fr' ? 'Sévérité:' : 'الخطورة:'}</span>
              <span className="font-medium capitalize">{alert.severity}</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span>{lang === 'fr' ? 'Créé le:' : 'تم الإنشاء:'}</span>
              <span className="font-medium">
                {new Date(alert.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-SA')}
              </span>
            </div>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAlertClick?.(alert)}
            className={`mt-4 w-full py-2 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${
              alert.isExpired
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white/20 hover:bg-white/30 text-current backdrop-blur-sm border border-white/30'
            }`}
          >
            {lang === 'fr' ? 'Ajouter une dépense' : 'إضافة نفقة'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

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

  // Filter maintenance alerts by status (exclude 'ok' status which means resolved)
  const maintenanceAlerts = cars
    .flatMap(car => [
      { type: 'vidange', alert: getVidangeAlert(car, vehicleExpenses), car },
      { type: 'assurance', alert: getAssuranceAlert(car, vehicleExpenses), car },
      { type: 'controle', alert: getControleAlert(car, vehicleExpenses), car },
      { type: 'chaine', alert: getChaineAlert(car, vehicleExpenses), car }
    ])
    .filter(item => item.alert !== null && item.alert.status !== 'ok')
    .map(item => ({
      ...item.alert,
      type: item.type,
      carId: item.car.id,
      carInfo: `${item.car.brand} ${item.car.model} - ${item.car.registration}`,
      id: `${item.car.id}-${item.type}`,
      severity: (item.alert as any).status === 'overdue' ? 'critical' : (item.alert as any).status === 'warning' ? 'high' : 'low',
      title: item.type === 'vidange' ? 'Vidange' : item.type === 'assurance' ? 'Assurance' : item.type === 'controle' ? 'Contrôle' : 'Chaîne',
      daysUntilDue: (item.alert as any).daysRemaining || 0,
      dueDate: (item.alert as any).expirationDate || null,
      currentMileage: (item.alert as any).currentMileage || 0,
      nextServiceMileage: (item.alert as any).nextVidangeKm || 0,
      isExpired: (item.alert as any).status === 'overdue'
    } as MaintenanceAlert));

  const reservationAlerts = getReservationAlerts(reservations);

  // Commandes du site public en attente d'acceptation par l'agence
  // (statut dédié 'website_reservation', avant acceptation).
  const pendingWebOrdersCount = reservations.filter(
    r => r.source === 'website' && r.status === 'website_reservation'
  ).length;

  // Apply alert filter
  let visibleAlerts = maintenanceAlerts;
  let visibleResAlerts = reservationAlerts;
  
  if (alertFilter === 'maintenance') {
    visibleResAlerts = [];
  } else if (alertFilter === 'reservations') {
    visibleAlerts = [];
  }

  const criticalAlerts = visibleAlerts.filter(a => a.severity === 'critical');
  const highAlerts = visibleAlerts.filter(a => a.severity === 'high');
  const otherAlerts = visibleAlerts.filter(a => a.severity !== 'critical' && a.severity !== 'high');

  const handleAlertClick = (alert: MaintenanceAlert) => {
    // Navigate to maintenance page with pre-selected car and expense type
    navigate('/maintenance', {
      state: {
        selectedCarId: alert.carId,
        expenseType: alert.type,
        showExpenseModal: true
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-saas-primary-via border-t-transparent rounded-full"
        />
        <span className="ml-4 text-saas-text-main font-medium">
          {lang === 'fr' ? 'Chargement du tableau de bord...' : 'جاري تحميل لوحة القيادة...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-saas-text-main mb-2">
            {lang === 'fr' ? 'Erreur de chargement' : 'خطأ في التحميل'}
          </h3>
          <p className="text-saas-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Alerte : nouvelles commandes du site web en attente d'acceptation */}
      <AnimatePresence>
        {pendingWebOrdersCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => navigate('/website-commandes')}
            className="group relative w-full flex items-center gap-4 sm:gap-5 overflow-hidden bg-gradient-to-r from-indigo-500 via-blue-600 to-blue-700 rounded-3xl px-5 sm:px-6 py-5 text-left text-white shadow-xl shadow-indigo-500/30 transition-all hover:shadow-2xl hover:shadow-indigo-500/40"
          >
            {/* Reflet animé qui balaie la carte */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] bg-white/10"
              animate={{ x: ['0%', '400%'] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
            />

            {/* Cloche + pastille du nombre */}
            <span className="relative flex-shrink-0">
              <motion.span
                className="absolute -inset-2 rounded-full bg-white/25"
                animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-3xl backdrop-blur"
              >
                🔔
              </motion.span>
              <span className="absolute -top-1.5 -right-1.5 min-w-[24px] h-6 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-black rounded-full ring-2 ring-white shadow-lg">
                {pendingWebOrdersCount > 99 ? '99+' : pendingWebOrdersCount}
              </span>
            </span>

            <div className="relative flex-1 min-w-0">
              <p className="font-black text-base sm:text-lg uppercase tracking-tight">
                {lang === 'fr'
                  ? `${pendingWebOrdersCount} nouvelle${pendingWebOrdersCount > 1 ? 's' : ''} commande${pendingWebOrdersCount > 1 ? 's' : ''} du site web`
                  : `${pendingWebOrdersCount} طلب جديد من الموقع`}
              </p>
              <p className="text-indigo-100 text-xs sm:text-sm font-medium">
                {lang === 'fr'
                  ? 'En attente de votre acceptation — cliquez pour les traiter'
                  : 'في انتظار موافقتك — انقر لمعالجتها'}
              </p>
            </div>
            <span className="relative px-4 sm:px-5 py-2.5 bg-white/20 backdrop-blur border border-white/30 font-bold rounded-xl text-sm whitespace-nowrap transition-transform group-hover:translate-x-1">
              {lang === 'fr' ? 'Traiter →' : 'معالجة →'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Alert Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-2xl border border-saas-border shadow-sm p-4">
        <h3 className="text-xs font-bold text-saas-text-muted uppercase tracking-widest sm:mr-1">
          {lang === 'fr' ? 'Filtrer les alertes' : 'تصفية التنبيهات'}
        </h3>

        <div className="flex flex-wrap gap-2">
          {([
            { key: 'all',          fr: 'Toutes',       ar: 'الجميع',  emoji: '📋', active: 'from-blue-500 to-indigo-600 shadow-blue-500/30' },
            { key: 'maintenance',  fr: 'Maintenance',  ar: 'الصيانة', emoji: '🔧', active: 'from-emerald-500 to-teal-600 shadow-emerald-500/30' },
            { key: 'reservations', fr: 'Réservations', ar: 'الحجوزات', emoji: '📅', active: 'from-cyan-500 to-sky-600 shadow-cyan-500/30' },
          ] as const).map(opt => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAlertFilter(opt.key)}
              className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wide transition-all duration-300 flex items-center gap-2 border ${
                alertFilter === opt.key
                  ? `bg-gradient-to-r ${opt.active} text-white border-transparent shadow-lg`
                  : 'bg-saas-bg border-saas-border text-saas-text-muted hover:text-saas-text-main hover:border-saas-primary-via/40'
              }`}
            >
              <span className="text-base">{opt.emoji}</span>
              <span>{lang === 'fr' ? opt.fr : opt.ar}</span>
            </motion.button>
          ))}
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

      {/* Enhanced Header with Better Design */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 rounded-3xl text-white shadow-2xl">
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-2">
            <motion.h1
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-4xl font-black tracking-tighter uppercase flex items-center gap-4"
            >
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-5xl"
              >
                📊
              </motion.span>
              {lang === 'fr' ? 'Tableau de Bord' : 'لوحة القيادة'}
            </motion.h1>
            <motion.p
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-blue-100 font-bold text-sm uppercase tracking-[0.3em]"
            >
              {lang === 'fr' ? 'Vue d\'ensemble Premium' : 'نظرة عامة مميزة'}
            </motion.p>
            <motion.p
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-blue-200 text-sm font-medium mt-3 flex items-center gap-2"
            >
              <span className="text-lg">🕐</span>
              {currentTime.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </motion.p>
          </div>

          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-3xl font-black text-white">
                {stats.totalClients}
              </div>
              <div className="text-xs text-blue-200 uppercase tracking-widest">
                {lang === 'fr' ? 'Clients' : 'العملاء'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Key Metrics with Better Gradients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <motion.div
          initial={{ opacity: 0, y: 30, rotateY: -15 }}
          animate={{ opacity: 1, y: 0, rotateY: 0 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
          whileHover={{ scale: 1.05, rotateY: 5 }}
          className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 p-6 rounded-3xl text-white shadow-2xl hover:shadow-blue-500/25"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/90 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                {lang === 'fr' ? 'Réservations Actives' : 'الحجوزات النشطة'}
              </p>
              <p className="text-3xl font-black mb-3">{stats.activeReservations}</p>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  📅
                </motion.div>
                <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">
                  {lang === 'fr' ? 'Ce mois' : 'هذا الشهر'}
                </span>
              </div>
            </div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="text-6xl opacity-90"
            >
              🚗
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, rotateY: -15 }}
          animate={{ opacity: 1, y: 0, rotateY: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
          whileHover={{ scale: 1.05, rotateY: 5 }}
          className="relative overflow-hidden bg-gradient-to-br from-orange-400 via-red-500 to-pink-600 p-6 rounded-3xl text-white shadow-2xl hover:shadow-orange-500/25"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/90 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                {lang === 'fr' ? 'Véhicules Disponibles' : 'المركبات المتاحة'}
              </p>
              <p className="text-3xl font-black mb-3">
                {stats.availableCars}/{stats.totalCars}
              </p>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                >
                  🚙
                </motion.div>
                <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">
                  {Math.round((stats.availableCars / stats.totalCars) * 100)}%
                </span>
              </div>
            </div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="text-6xl opacity-90"
            >
              🏁
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, rotateY: -15 }}
          animate={{ opacity: 1, y: 0, rotateY: 0 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 100 }}
          whileHover={{ scale: 1.05, rotateY: 5 }}
          className="relative overflow-hidden bg-gradient-to-br from-red-500 via-rose-600 to-pink-700 p-6 rounded-3xl text-white shadow-2xl hover:shadow-red-500/25"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/90 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                {lang === 'fr' ? 'Alertes Maintenance' : 'تنبيهات الصيانة'}
              </p>
              <p className="text-3xl font-black mb-3">{stats.maintenanceAlerts}</p>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ⚠️
                </motion.div>
                <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">
                  {criticalAlerts.length} {lang === 'fr' ? 'critiques' : 'حرجة'}
                </span>
              </div>
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="text-6xl opacity-90"
            >
              🔧
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart with Better Design */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-gray-100 p-8 rounded-3xl border border-slate-200 shadow-xl"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full -translate-y-16 translate-x-16"></div>

          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-3xl"
              >
                📊
              </motion.div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                {lang === 'fr' ? 'Évolution des Revenus' : 'تطور الإيرادات'}
              </h3>
            </div>

            <div className="space-y-6">
              {stats.revenueByMonth.map((item, index) => (
                <motion.div
                  key={item.month}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200 hover:shadow-lg transition-all"
                >
                  <div className="w-12 text-lg font-black text-slate-700 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                    {item.month}
                  </div>
                  <div className="flex-1">
                    <div className="bg-slate-200 rounded-full h-4 overflow-hidden shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.revenue / Math.max(...stats.revenueByMonth.map(m => m.revenue))) * 100}%` }}
                        transition={{ delay: 1 + index * 0.1, duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-700 rounded-full shadow-lg"
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <div className="text-lg font-black text-slate-800">
                      {item.revenue.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest">
                      DZD
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Car Utilization with Enhanced Design */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          className="relative overflow-hidden bg-gradient-to-br from-white via-emerald-50 to-teal-100 p-8 rounded-3xl border border-emerald-200 shadow-xl"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-full -translate-y-16 translate-x-16"></div>

          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-3xl"
              >
                🚗
              </motion.div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                {lang === 'fr' ? 'Taux d\'Utilisation' : 'معدلات الاستخدام'}
              </h3>
            </div>

            <div className="space-y-6">
              {stats.carUtilization.map((car, index) => (
                <motion.div
                  key={car.carId}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + index * 0.1 }}
                  className="p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-emerald-200 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-4">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
                      className="text-2xl"
                    >
                      {car.utilization > 80 ? '🔴' : car.utilization > 60 ? '🟠' : '🟢'}
                    </motion.div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-800">{car.carInfo}</span>
                        <span className="text-lg font-black text-emerald-600">{car.utilization}%</span>
                      </div>
                      <div className="bg-emerald-200 rounded-full h-3 overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${car.utilization}%` }}
                          transition={{ delay: 1.1 + index * 0.1, duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-full shadow-lg ${
                            car.utilization > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                            car.utilization > 60 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                            'bg-gradient-to-r from-emerald-500 to-teal-600'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8"
      >
        <motion.div
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 p-8 rounded-3xl text-white shadow-2xl hover:shadow-blue-500/25 text-center group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl mb-6"
            >
              📅
            </motion.div>
            <h4 className="text-xl font-black uppercase tracking-tighter mb-3">
              {lang === 'fr' ? 'Nouvelles Réservations' : 'حجوزات جديدة'}
            </h4>
            <p className="text-blue-100 text-sm mb-6 leading-relaxed">
              {lang === 'fr' ? 'Créer une nouvelle réservation pour vos clients' : 'إنشاء حجز جديد لعملائك'}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/planificateur')}
              className="w-full py-3 bg-white/20 backdrop-blur-sm text-white rounded-2xl hover:bg-white/30 transition-all font-bold uppercase tracking-widest text-sm border border-white/30"
            >
              🚀 {lang === 'fr' ? 'Créer' : 'إنشاء'}
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-8 rounded-3xl text-white shadow-2xl hover:shadow-emerald-500/25 text-center group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-cyan-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="text-6xl mb-6"
            >
              🚗
            </motion.div>
            <h4 className="text-xl font-black uppercase tracking-tighter mb-3">
              {lang === 'fr' ? 'Ajouter un Véhicule' : 'إضافة مركبة'}
            </h4>
            <p className="text-emerald-100 text-sm mb-6 leading-relaxed">
              {lang === 'fr' ? 'Étendre votre flotte automobile' : 'توسيع أسطولك السيارات'}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/vehicules')}
              className="w-full py-3 bg-white/20 backdrop-blur-sm text-white rounded-2xl hover:bg-white/30 transition-all font-bold uppercase tracking-widest text-sm border border-white/30"
            >
              ➕ {lang === 'fr' ? 'Ajouter' : 'إضافة'}
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-red-600 to-pink-700 p-8 rounded-3xl text-white shadow-2xl hover:shadow-orange-500/25 text-center group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="text-6xl mb-6"
            >
              📊
            </motion.div>
            <h4 className="text-xl font-black uppercase tracking-tighter mb-3">
              {lang === 'fr' ? 'Rapports Détaillés' : 'تقارير مفصلة'}
            </h4>
            <p className="text-orange-100 text-sm mb-6 leading-relaxed">
              {lang === 'fr' ? 'Analyser vos performances et statistiques' : 'تحليل أدائك والإحصائيات'}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/rapports')}
              className="w-full py-3 bg-white/20 backdrop-blur-sm text-white rounded-2xl hover:bg-white/30 transition-all font-bold uppercase tracking-widest text-sm border border-white/30"
            >
              📈 {lang === 'fr' ? 'Voir' : 'عرض'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};