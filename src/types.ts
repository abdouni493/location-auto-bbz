export type Language = 'fr' | 'ar';

export type UserRole = 'admin' | 'worker' | 'driver';

export interface User {
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export interface SidebarItem {
  id: string;
  label: {
    fr: string;
    ar: string;
  };
  icon: string;
}

/** Devises supportées. DZD est la devise de base (taux = 1). */
export type CurrencyCode = 'DZD' | 'USD' | 'EUR' | 'GBP';

/** Devise du registre global (table `currency_settings`). */
export interface CurrencySetting {
  code: CurrencyCode;
  label: string;
  symbol: string;
  /** Combien de DZD vaut 1 unité de cette devise. */
  rateToDzd: number;
  isActive: boolean;
  isBase: boolean;
  displayOrder: number;
}

/**
 * Tarifs d'une voiture dans une devise étrangère.
 * Les prix sont calculés depuis les prix DZD via `rate`, mais restent
 * modifiables à la main (l'agence peut arrondir).
 */
export interface CarCurrencyPricing {
  active: boolean;
  /** Taux de change saisi pour CETTE voiture : 1 unité = `rate` DZD. */
  rate: number;
  priceDay: number;
  priceWeek: number;
  priceMonth: number;
  deposit: number;
}

/** Devises étrangères activées sur une voiture (DZD n'y figure jamais). */
export type CarCurrencyConfig = Partial<Record<Exclude<CurrencyCode, 'DZD'>, CarCurrencyPricing>>;

/** Propriétaire du véhicule : l'agence, ou un tiers qui touche une part. */
export type CarOwnerType = 'personal' | 'third_party';

export interface Car {
  id: string;
  brand: string;
  model: string;
  registration: string;
  year: number;
  color: string;
  vin: string;
  energy: string;
  transmission: string;
  seats: number;
  doors: number;
  priceDay: number;
  priceWeek: number;
  priceMonth: number;
  deposit: number;
  images: string[];
  mileage: number;
  fuelLevel?: 'full' | 'half' | 'quarter' | 'eighth' | 'empty';
  // Statut dérivé des réservations réelles (calculé par getCarsWithRealStatus).
  // Seul 'maintenance' peut être saisi manuellement en base.
  status?: 'disponible' | 'reserve' | 'louer' | 'maintenance';
  // Masquée du site public (visible par défaut). Les vues admin l'affichent quand même.
  isHiddenFromSite?: boolean;

  /** 'personal' (défaut) = voiture de l'agence ; 'third_party' = voiture d'un tiers. */
  ownerType?: CarOwnerType;
  ownerName?: string;
  ownerPhone?: string;
  /** Montant EN DZD que l'agence garde par JOUR de location (voiture d'un tiers). */
  agencyDailyShare?: number;
  /** Tarifs en devises étrangères (USD/EUR/GBP) activés voiture par voiture. */
  currencyConfig?: CarCurrencyConfig;
}

export type ExpenseType = 'vidange' | 'assurance' | 'controle' | 'chaine' | 'autre';

export interface Expense {
  id: string;
  carId: string;
  type: ExpenseType;
  cost: number;
  date: string;
  note?: string;
  // Specific fields
  nextVidangeKm?: number;
  expirationDate?: string;
  name?: string; // For 'autre'
}

export interface Rental {
  id: string;
  carId: string;
  clientId: string;
  clientName?: string;
  startDate: string;
  endDate: string;
  totalCost: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
}

export interface Agency {
  id: string;
  name: string;
  address: string;
  city: string;
  createdAt?: string;
}

/**
 * Entreprise cliente — sert aux locations professionnelles et alimente les
 * mentions légales du contrat et de la facture.
 */
export interface Entreprise {
  id: string;
  name: string;
  /** Registre de Commerce, ex : 12/00-0000000B19 */
  rc?: string;
  /** Article d'imposition, ex : 000000000 */
  art?: string;
  /** N° d'Identification Statistique, ex : 000000000000000 */
  nis?: string;
  /** N° d'Identification Fiscale, ex : 000000000000000 */
  nif?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Totaux d'une entreprise, calculés sur toutes ses réservations. */
export interface EntrepriseStats {
  reservationsCount: number;
  total: number;
  totalPaid: number;
  totalRemaining: number;
}

export interface Client {
  id: string;
  // Personal Information
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;

  // Official Documents
  idCardNumber?: string;
  licenseNumber: string;
  licenseExpirationDate?: string;
  licenseDeliveryDate?: string;
  licenseDeliveryPlace?: string;

  // Additional Documents
  documentType?: 'id_card' | 'passport' | 'none';
  documentNumber?: string;
  documentDeliveryDate?: string;
  documentExpirationDate?: string;
  documentDeliveryAddress?: string;

  // Address & Location
  wilaya: string;
  completeAddress?: string;

  // Media
  profilePhoto?: string;
  scannedDocuments?: string[];

  createdAt: string;
  agencyId?: string;
}

export type PaymentType = 'daily' | 'monthly';

export interface WorkerAdvance {
  id: string;
  amount: number;
  date: string;
  note?: string;
  description?: string;
  /** true une fois déduit d'un paiement : n'apparaît plus dans les en-cours. */
  settled?: boolean;
}

export interface WorkerAbsence {
  id: string;
  cost: number;
  date: string;
  note?: string;
  description?: string;
  settled?: boolean;
}

export interface WorkerPayment {
  id: string;
  amount: number;
  date: string;
  baseSalary: number;
  advances: number;
  absences: number;
  netSalary: number;
  note?: string;
  description?: string;
  /** Période couverte par ce paiement. */
  periodStart?: string;
  periodEnd?: string;
  /** Acomptes / absences soldés par ce paiement. */
  advanceIds?: string[];
  absenceIds?: string[];
  /** true si le montant a été forcé à la main plutôt que calculé. */
  isManualAmount?: boolean;
}

/** Rôle libre créé depuis la page Équipe (table `worker_roles`). */
export interface WorkerRole {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Permissions d'un employé : une entrée par page visible dans SA sidebar,
 * dont la valeur liste les actions (boutons) qu'il a le droit d'utiliser.
 * Une page absente de l'objet est invisible pour lui.
 */
export type WorkerPermissions = Record<string, string[]>;

export interface Worker {
  id: string;
  // Personal Information
  fullName: string;
  dateOfBirth?: string;
  phone: string;
  email: string;
  address?: string;
  profilePhoto?: string;
  /** Numéro de pièce d'identité (facultatif). */
  idCardNumber?: string;

  // Work Information
  type: 'admin' | 'worker' | 'driver';
  roleId?: string;
  roleName?: string;
  /** Date d'entrée en fonction. */
  startDate?: string;
  /** false = employé non rémunéré (bénévole, stagiaire…). */
  isPaid?: boolean;
  paymentType?: PaymentType;
  baseSalary: number;
  isActive?: boolean;

  // Login Credentials — un compte n'est créé dans Supabase Auth que si
  // `hasAccount` est vrai (voir la RPC create_worker_account / set_worker_account).
  hasAccount?: boolean;
  userId?: string;
  username: string;
  password: string;

  // Records
  advances: WorkerAdvance[];
  absences: WorkerAbsence[];
  payments: WorkerPayment[];
  permissions?: WorkerPermissions;

  createdAt: string;
}
export interface StoreExpense {
  id: string;
  name: string;
  cost: number;
  date: string;
  note?: string;
  icon?: string;
  createdAt: string;
}

export interface VehicleExpense {
  id: string;
  carId: string;
  type: ExpenseType;
  cost: number;
  date: string;
  note?: string;
  currentMileage?: number;
  nextVidangeKm?: number;
  expirationDate?: string;
  expenseName?: string;
  createdAt: string;
}

export interface ReservationStep1 {
  carId: string;
  departureDate: string;
  departureTime: string;
  departureAgency: string;
  returnDate: string;
  returnTime: string;
  returnAgency: string;
  differentReturnAgency: boolean;
}

export interface ReservationStep2 {
  photo?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  licenseNumber: string;
  licenseExpiration?: string;
  licenseDelivery?: string;
  licenseDeliveryPlace?: string;
  additionalDocType?: 'id_card' | 'passport' | 'none';
  additionalDocNumber?: string;
  additionalDocDelivery?: string;
  additionalDocExpiration?: string;
  additionalDocDeliveryAddress?: string;
  wilaya: string;
  completeAddress?: string;
  scannedDocuments?: string[];
}

export interface Reservation {
  id: string;
  step1: ReservationStep1;
  step2: ReservationStep2;
  carInfo: Car;
  totalDays: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

// Une offre spéciale est une PROMOTION attachée à une voiture existante.
// isActive = affichée sur le site (le toggle masquer/afficher) ;
// startDate/endDate (optionnelles) limitent la période de validité de la promo.
export interface SpecialOffer {
  id: string;
  carId: string;
  car: Car;
  oldPrice: number;
  newPrice: number;
  note?: string;
  isActive: boolean;
  createdAt: string;
  label?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  startDate?: string;
  endDate?: string;
}

export interface ContactInfo {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  whatsapp?: string;
  phone?: string;
  address?: string;
  email?: string;
}

export interface WebsiteSettings {
  name: string;
  description: string;
  logo?: string;
  phone_number_2?: string;
  bank_number?: string;
  address?: string;
  phone?: string;
  /** Image de fond du landing du site public (URL storage, affichée floutée). */
  landing_background?: string;
}

// Code promo utilisable sur la réservation du site public
export interface PromoCode {
  id: string;
  code: string;
  discountPercentage: number;
  isActive: boolean;
  isUsed: boolean;
  usedAt?: string | null;
  reservationId?: string | null;
  createdAt: string;
}

// Planner Types
export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  idCardNumber?: string;
  licenseNumber: string;
  licenseExpiration?: string;
  licenseDelivery?: string;
  licenseDeliveryPlace?: string;
  additionalDocType?: 'id_card' | 'passport' | 'none';
  additionalDocNumber?: string;
  additionalDocDelivery?: string;
  additionalDocExpiration?: string;
  additionalDocDeliveryAddress?: string;
  wilaya: string;
  completeAddress?: string;
  scannedDocuments?: string[];
  profilePhoto?: string;
  createdAt: string;
}

export interface InspectionItem {
  id: string;
  category: 'security' | 'equipment' | 'comfort' | 'cleanliness';
  name: string;
  checked: boolean;
}

export interface VehicleInspection {
  id: string;
  reservationId: string;
  type: 'departure' | 'return';
  mileage: number;
  fuelLevel: 'full' | 'half' | 'quarter' | 'eighth' | 'empty';
  location: string;
  date: string;
  time: string;
  interiorPhotos: string[];
  exteriorPhotos: string[];
  inspectionItems: InspectionItem[];
  notes: string;
  signature?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  date: string;
  method: 'cash' | 'card' | 'transfer' | 'check';
  note?: string;
  createdAt: string;
}

export interface AdditionalService {
  id: string;
  category: 'decoration' | 'equipment' | 'insurance' | 'service';
  name: string;
  description?: string;
  price: number;
  selected: boolean;
  /**
   * Service obligatoire : coché d'office et non décochable sur l'étape
   * « Services » du formulaire admin ET du wizard du site public.
   */
  isMandatory?: boolean;
}

/**
 * Politique kilométrique globale (table `app_settings`, clé `mileage_policy`).
 * Appliquée à la clôture de TOUTES les locations.
 */
export interface MileagePolicy {
  enabled: boolean;
  /** Kilomètres inclus par jour de location. */
  dailyLimitKm: number;
  /** DZD facturés par km au-delà de la limite. */
  feePerExtraKm: number;
  /** DZD facturés par cran de carburant manquant. */
  fuelFeePerLevel: number;
  /** Pré-remplit les frais supplémentaires à l'ouverture de « Terminer ». */
  autoApplyFees: boolean;
}

/** Options d'impression du contrat (table `app_settings`, clé `contract_options`). */
export interface ContractOptions {
  /** Affiche les prix et le total sur le contrat imprimé (vrai par défaut). */
  showPrices: boolean;
  showEntreprise: boolean;
}

// Un item d'un forfait d'assurance de protection (avec son statut vrai/faux).
export interface ProtectionAssuranceItem {
  linkId?: string;
  itemId: string;
  name: string;
  status: boolean;
  displayOrder?: number;
}

// Un forfait d'assurance de protection (nom + prix/jour + liste d'items).
export interface ProtectionAssurance {
  id: string;
  name: string;
  pricePerDay: number;
  isActive: boolean;
  createdAt: string;
  items: ProtectionAssuranceItem[];
}

export interface ReservationDetails {
  id: string;
  clientId: string;
  client: Client;
  carId: string;
  car: Car;
  step1: ReservationStep1;
  step2: ReservationStep2;
  additionalServices: AdditionalService[];
  deposit: number;
  totalDays: number;
  totalPrice: number;
  discountAmount: number;
  discountType: 'percentage' | 'fixed';
  advancePayment: number;
  remainingPayment: number;
  // 'website_reservation' : commande brute reçue du site public, en attente
  // d'acceptation par l'agence (n'apparaît PAS dans le planificateur).
  status: 'website_reservation' | 'pending' | 'accepted' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  // Forfait d'assurance de protection sélectionné (snapshot + référence).
  protectionAssuranceId?: string;
  protectionAssuranceName?: string;
  protectionAssurancePrice?: number; // prix/jour au moment de la réservation
  protectionAssurance?: ProtectionAssurance; // détail (items) chargé pour l'affichage
  departureInspection?: VehicleInspection;
  returnInspection?: VehicleInspection;
  payments: Payment[];
  excessMileage?: number;
  missingFuel?: number;
  additionalFees: number;
  tvaApplied: boolean;
  notes?: string;
  conditions?: string;
  createdAt: string;
  activatedAt?: string;
  completedAt?: string;
  createdBy?: string;
  createdByName?: string;
  /** Origine de la réservation : 'website' (site public) ou 'agency' (admin). */
  source?: 'website' | 'agency';

  // ── Devise (site public : le client réserve dans la devise affichée) ──
  /** Devise choisie par le client. Le total en base reste TOUJOURS en DZD. */
  currencyCode?: CurrencyCode;
  /** Taux figé à la réservation : 1 unité de `currencyCode` = `currencyRate` DZD. */
  currencyRate?: number;
  /** Total exprimé dans `currencyCode` (pour réafficher le montant vu par le client). */
  totalPriceCurrency?: number;

  // ── Code promo (site public, usage unique) ──
  promoCodeId?: string;
  promoCode?: string;
  promoDiscountPercentage?: number;
  promoDiscountAmount?: number;

  // ── Timbre fiscal ──
  /** Barème : 1 % (300–30 000 DA), 1,5 % (30 001–100 000 DA), 2 % (> 100 000 DA). */
  timbreEnabled?: boolean;
  timbreAmount?: number;

  // ── Entreprise (mentions légales du contrat / de la facture) ──
  entrepriseId?: string;
  entreprise?: Entreprise;

  // ── Informations de vol (étape « infos client » du site public) ──
  flightNumber?: string;
  flightDate?: string;
  flightTime?: string;
  flightTicketImage?: string;

  // ── Kilométrage & carburant à la clôture ──
  /** Limite en km applicable à cette location (snapshot de la politique globale). */
  mileageLimitKm?: number;
  excessMileageKm?: number;
  excessMileageFee?: number;
  missingFuelLevels?: number;
  missingFuelFee?: number;

  /** Affiche les prix sur le contrat imprimé (vrai par défaut). */
  contractShowPrices?: boolean;
}

export interface Invoice {
  id: string;
  reservationId: string;
  clientId: string;
  clientName: string;
  carId: string;
  carInfo: string;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  tvaAmount: number;
  additionalFees: number;
  totalAmount: number;
  totalPaid: number;
  remainingAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
  type: 'invoice' | 'quote' | 'contract';
  payments: Payment[];
  createdAt: string;
}

export interface MaintenanceAlert {
  id: string;
  carId: string;
  carInfo: string;
  type: 'vidange' | 'assurance' | 'controle' | 'chaine';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  isExpired: boolean;
  daysUntilDue?: number;
  currentMileage?: number;
  nextServiceMileage?: number;
  createdAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalReservations: number;
  activeReservations: number;
  totalClients: number;
  totalCars: number;
  availableCars: number;
  maintenanceAlerts: number;
  overduePayments: number;
  recentReservations: ReservationDetails[];
  revenueByMonth: { month: string; revenue: number }[];
  carUtilization: { carId: string; carInfo: string; utilization: number }[];
}

export interface WebsiteOrder {
  id: string;
  carId: string;
  car: Car;
  step1: ReservationStep1;
  step2: ReservationStep2;
  step3: {
    additionalServices: AdditionalService[];
  };
  totalDays: number;
  totalPrice: number;
  servicesTotal: number;
  // Assurance de protection sélectionnée
  protectionAssurance?: ProtectionAssurance;
  protectionAssuranceName?: string;
  assuranceTotal?: number;
  // 'website_reservation' : nouvelle commande en attente d'acceptation par l'agence.
  status: 'website_reservation' | 'pending' | 'accepted' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
  source: 'website';

  /** Devise dans laquelle le client a réservé ('DZD' si aucune conversion). */
  currencyCode?: CurrencyCode;
  /** Taux figé à la commande : 1 unité = `currencyRate` DZD. */
  currencyRate?: number;
  totalPriceCurrency?: number;

  /** Code promo consommé. Absent = aucun code utilisé (ne rien afficher). */
  promoCode?: string;
  promoDiscountPercentage?: number;
  promoDiscountAmount?: number;

  /** Informations de vol saisies par le client. */
  flightNumber?: string;
  flightDate?: string;
  flightTime?: string;
  flightTicketImage?: string;
}

// Document Template Types
export type DocumentType = 'contrat' | 'devis' | 'facture' | 'recu' | 'engagement';

export interface DocumentField {
  x: number;
  y: number;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  maxWidth?: number;
  customText?: string; // For custom text blocks
  width?: number; // For images like logo
  height?: number; // For images like logo
  text?: string; // For dynamic text content
}

export interface DocumentTemplate {
  [key: string]: DocumentField;
}

export interface DocumentTemplates {
  contrat?: DocumentTemplate;
  devis?: DocumentTemplate;
  facture?: DocumentTemplate;
  recu?: DocumentTemplate;
  engagement?: DocumentTemplate;
}

export interface AgencySettings {
  id: string;
  agencyName: string;
  slogan?: string;
  address?: string;
  phone?: string;
  logo?: string;
  documentTemplates?: DocumentTemplates;
  createdAt: string;
  updatedAt: string;
}