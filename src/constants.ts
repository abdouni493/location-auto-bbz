import { SidebarItem, Agency, Car } from './types';

/**
 * Scène Spline 3D du hero de la page d'accueil publique.
 * TODO : coller ici l'URL .splinecode d'une scène de VOITURE dont vous avez
 * les droits (export "Code" → "React" dans votre compte Spline, ex :
 * "https://prod.spline.design/xxxxxxxx/scene.splinecode").
 * Tant que cette constante est vide, le hero affiche le visuel statique
 * (anneaux animés + logo) — rien ne casse.
 */
export const HERO_SPLINE_SCENE_URL = '';

/** Nom commercial affiché sur le site public (navbar, footer, pages vitrine). */
export const SITE_NAME = 'MHD AUTO';

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'dashboard', label: { fr: 'Tableau de bord', ar: 'لوحة القيادة' }, icon: '📊' },
  { id: 'planner', label: { fr: 'Planificateur', ar: 'المخطط' }, icon: '📅' },
  { id: 'web-orders', label: { fr: 'Website commandes', ar: 'طلبات الموقع' }, icon: '🛒' },
  { id: 'reservations', label: { fr: 'Contrats', ar: 'العقود' }, icon: '🧾' },
  { id: 'protection-services', label: { fr: 'Protection & Services', ar: 'الحماية والخدمات' }, icon: '🛡️' },
  { id: 'vehicles', label: { fr: 'Véhicules', ar: 'المركبات' }, icon: '🚗' },
  { id: 'maintenance', label: { fr: 'Maintenance', ar: 'الصيانة' }, icon: '🔧' },
  { id: 'clients', label: { fr: 'Clients', ar: 'العملاء' }, icon: '👥' },
  { id: 'agencies', label: { fr: 'Agences', ar: 'الوكالات' }, icon: '🏢' },
  { id: 'team', label: { fr: 'Équipe', ar: 'الفريق' }, icon: '🤝' },
  { id: 'personalization', label: { fr: 'Personalisation', ar: 'التخصيص' }, icon: '🎨' },
  { id: 'expenses', label: { fr: 'Dépenses', ar: 'المصاريف' }, icon: '📉' },
  { id: 'web-mgmt', label: { fr: 'Website management', ar: 'إدارة الموقع' }, icon: '🌐' },
  { id: 'car-gains', label: { fr: 'Gains par Véhicule', ar: 'الأرباح حسب المركبة' }, icon: '💰' },
  { id: 'reports', label: { fr: 'Rapports', ar: 'التقارير' }, icon: '📄' },
  { id: 'config', label: { fr: 'Configuration', ar: 'الإعدادات' }, icon: '🛠️' },
];

// Agencies data
export const AGENCIES: Agency[] = [
  {
    id: '1',
    name: 'Agence Centre Ville',
    address: '123 Rue Principal, Alger Centre',
    city: 'Alger'
  },
  {
    id: '2',
    name: 'Agence Aéroport',
    address: 'Aéroport Houari Boumediene, Alger',
    city: 'Alger'
  },
  {
    id: '3',
    name: 'Agence Oran',
    address: '456 Boulevard de la République, Oran',
    city: 'Oran'
  },
  {
    id: '4',
    name: 'Agence Constantine',
    address: '789 Rue de France, Constantine',
    city: 'Constantine'
  }
];

// Car images data
export const CAR_IMAGES = {
  toyota: [
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop'
  ],
  renault: [
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'
  ],
  peugeot: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'
  ],
  citroen: [
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop'
  ],
  bmw: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'
  ],
  mercedes: [
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop'
  ],
  audi: [
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop'
  ],
  default: [
    'https://images.unsplash.com/photo-1560958089-b8a63dd8aa8b?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1549399735-cef2e2c3f638?w=500&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop'
  ]
};

export const TRANSLATIONS = {
  fr: {
    login: 'Connexion',
    email: 'Email',
    password: 'Mot de passe',
    username: 'Nom d\'utilisateur',
    signup: 'Créer un compte',
    admin: 'Administrateur',
    worker: 'Employé',
    driver: 'Chauffeur',
    logout: 'Déconnexion',
    welcome: 'Bienvenue',
    changeLang: 'العربية',
  },
  ar: {
    login: 'تسجيل الدخول',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    username: 'اسم المستخدم',
    signup: 'إنشاء حساب',
    admin: 'مدير',
    worker: 'موظف',
    driver: 'سائق',
    logout: 'تسجيل الخروج',
    welcome: 'مرحباً',
    changeLang: 'Français',
  }
};
