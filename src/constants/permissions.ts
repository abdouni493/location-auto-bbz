import { SIDEBAR_ITEMS } from '../constants';

/**
 * Catalogue des permissions.
 *
 * Une permission d'employé = { pageId: [actionId, …] }.
 *   • la présence de `pageId` rend l'onglet visible dans SA sidebar ;
 *   • `actionId` autorise un bouton précis de cette page.
 *
 * Les actions sensibles (encaissement, suppression, suppression de paiement)
 * sont marquées `sensitive` pour être mises en évidence dans l'écran de
 * permissions — ce sont celles qu'un admin doit accorder en connaissance de
 * cause.
 */

export interface PermissionAction {
  id: string;
  label: { fr: string; ar: string };
  /** Action à risque : encaissement, suppression, annulation. */
  sensitive?: boolean;
}

export interface PermissionPage {
  id: string;
  label: { fr: string; ar: string };
  icon: string;
  actions: PermissionAction[];
}

const A = (
  id: string,
  fr: string,
  ar: string,
  sensitive = false
): PermissionAction => ({ id, label: { fr, ar }, sensitive });

/** Actions communes à la plupart des pages listes. */
const VIEW    = A('view',   'Consulter',  'عرض');
const CREATE  = A('create', 'Créer',      'إنشاء');
const EDIT    = A('edit',   'Modifier',   'تعديل');
const DELETE  = A('delete', 'Supprimer',  'حذف', true);
const EXPORT  = A('export', 'Exporter',   'تصدير');
const PRINT   = A('print',  'Imprimer',   'طباعة');

export const PERMISSION_PAGES: PermissionPage[] = [
  {
    id: 'dashboard',
    label: { fr: 'Tableau de bord', ar: 'لوحة القيادة' },
    icon: '📊',
    actions: [
      VIEW,
      A('view_revenue', 'Voir le chiffre d\'affaires', 'عرض الإيرادات', true),
      A('view_alerts',  'Voir les alertes',            'عرض التنبيهات'),
    ],
  },
  {
    id: 'planner',
    label: { fr: 'Planificateur', ar: 'المخطط' },
    icon: '📅',
    actions: [
      VIEW,
      A('create_reservation',   'Créer une réservation',   'إنشاء حجز'),
      A('edit_reservation',     'Modifier une réservation','تعديل حجز'),
      A('activate_reservation', 'Activer la location',     'تفعيل الإيجار'),
      A('terminate_reservation','Terminer la location',    'إنهاء الإيجار', true),
      A('cancel_reservation',   'Annuler une réservation', 'إلغاء حجز', true),
      A('add_payment',          'Ajouter un paiement',     'إضافة دفعة', true),
      A('delete_payment',       'Supprimer un paiement',   'حذف دفعة', true),
      A('print_contract',       'Imprimer le contrat',     'طباعة العقد'),
      A('print_invoice',        'Imprimer la facture',     'طباعة الفاتورة'),
      A('send_email',           'Envoyer par e-mail',      'إرسال بالبريد'),
      A('delete_reservation',   'Supprimer une réservation','حذف حجز', true),
    ],
  },
  {
    id: 'web-orders',
    label: { fr: 'Website commandes', ar: 'طلبات الموقع' },
    icon: '🛒',
    actions: [
      VIEW,
      A('accept_order', 'Accepter une commande', 'قبول الطلب'),
      A('reject_order', 'Refuser une commande',  'رفض الطلب', true),
      A('delete_order', 'Supprimer une commande','حذف الطلب', true),
    ],
  },
  {
    id: 'reservations',
    label: { fr: 'Contrats', ar: 'العقود' },
    icon: '🧾',
    actions: [
      VIEW,
      A('view_prices',    'Voir les montants',      'عرض المبالغ', true),
      A('add_payment',    'Ajouter un paiement',    'إضافة دفعة', true),
      A('delete_payment', 'Supprimer un paiement',  'حذف دفعة', true),
      PRINT,
      A('send_email',     'Envoyer par e-mail',     'إرسال بالبريد'),
      DELETE,
    ],
  },
  {
    id: 'protection-services',
    label: { fr: 'Protection & Services', ar: 'الحماية والخدمات' },
    icon: '🛡️',
    actions: [VIEW, CREATE, EDIT, DELETE, A('toggle_active', 'Activer / désactiver', 'تفعيل / تعطيل')],
  },
  {
    id: 'vehicles',
    label: { fr: 'Véhicules', ar: 'المركبات' },
    icon: '🚗',
    actions: [
      VIEW,
      CREATE,
      EDIT,
      DELETE,
      A('view_owner',       'Voir le propriétaire',      'عرض المالك', true),
      A('toggle_maintenance','Basculer en maintenance',  'التبديل إلى الصيانة'),
      A('toggle_site',      'Afficher / masquer du site','إظهار / إخفاء من الموقع'),
      A('view_history',     'Voir l\'historique',        'عرض السجل'),
      A('view_expenses',    'Voir les dépenses',         'عرض المصاريف', true),
    ],
  },
  {
    id: 'maintenance',
    label: { fr: 'Maintenance', ar: 'الصيانة' },
    icon: '🔧',
    actions: [VIEW, CREATE, EDIT, DELETE, A('resolve_alert', 'Résoudre une alerte', 'حل التنبيه')],
  },
  {
    id: 'clients',
    label: { fr: 'Clients', ar: 'العملاء' },
    icon: '👥',
    actions: [VIEW, CREATE, EDIT, DELETE, A('view_history', 'Voir l\'historique', 'عرض السجل'), A('view_documents', 'Voir les documents', 'عرض الوثائق', true)],
  },
  {
    id: 'entreprises',
    label: { fr: 'Entreprises', ar: 'الشركات' },
    icon: '🏛️',
    actions: [VIEW, CREATE, EDIT, DELETE, A('view_history', 'Voir l\'historique', 'عرض السجل'), A('view_totals', 'Voir les totaux', 'عرض المجاميع', true)],
  },
  {
    id: 'agencies',
    label: { fr: 'Agences', ar: 'الوكالات' },
    icon: '🏢',
    actions: [VIEW, CREATE, EDIT, DELETE],
  },
  {
    id: 'team',
    label: { fr: 'Équipe', ar: 'الفريق' },
    icon: '🤝',
    actions: [
      VIEW,
      CREATE,
      EDIT,
      DELETE,
      A('manage_permissions', 'Gérer les permissions', 'إدارة الصلاحيات', true),
      A('add_advance',        'Saisir un acompte',     'تسجيل دفعة مقدمة', true),
      A('add_absence',        'Saisir une absence',    'تسجيل غياب'),
      A('add_payment',        'Payer un employé',      'دفع راتب', true),
      A('delete_payment',     'Supprimer un paiement', 'حذف دفعة', true),
      A('manage_account',     'Gérer le compte de connexion', 'إدارة حساب الدخول', true),
    ],
  },
  {
    id: 'personalization',
    label: { fr: 'Personalisation', ar: 'التخصيص' },
    icon: '🎨',
    actions: [VIEW, EDIT, A('manage_templates', 'Gérer les modèles', 'إدارة القوالب')],
  },
  {
    id: 'expenses',
    label: { fr: 'Dépenses', ar: 'المصاريف' },
    icon: '📉',
    actions: [VIEW, CREATE, EDIT, DELETE, EXPORT],
  },
  {
    id: 'web-mgmt',
    label: { fr: 'Website management', ar: 'إدارة الموقع' },
    icon: '🌐',
    actions: [
      VIEW, CREATE, EDIT, DELETE,
      A('manage_promo',      'Gérer les codes promo', 'إدارة رموز الخصم', true),
      A('manage_currencies', 'Gérer les devises',     'إدارة العملات', true),
      A('edit_settings',     'Modifier les réglages', 'تعديل الإعدادات'),
    ],
  },
  {
    id: 'car-gains',
    label: { fr: 'Bénéfices par voiture', ar: 'أرباح كل سيارة' },
    icon: '💰',
    actions: [
      VIEW,
      A('view_agency_share', 'Voir la part de l\'agence', 'عرض حصة الوكالة', true),
      A('print_owner_report','Imprimer le rapport propriétaire', 'طباعة تقرير المالك'),
      EXPORT,
    ],
  },
  {
    id: 'reports',
    label: { fr: 'Rapports', ar: 'التقارير' },
    icon: '📄',
    actions: [VIEW, EXPORT, PRINT],
  },
  {
    id: 'config',
    label: { fr: 'Configuration', ar: 'الإعدادات' },
    icon: '🛠️',
    actions: [
      VIEW,
      EDIT,
      A('manage_security',  'Sécurité & mots de passe', 'الأمان وكلمات المرور', true),
      A('manage_mileage',   'Politique kilométrique',   'سياسة المسافة', true),
    ],
  },
];

/** Accès rapide par identifiant de page. */
export const PERMISSION_PAGE_MAP: Record<string, PermissionPage> =
  Object.fromEntries(PERMISSION_PAGES.map(p => [p.id, p]));

/** Toutes les actions d'une page (identifiants seulement). */
export const allActionsOf = (pageId: string): string[] =>
  PERMISSION_PAGE_MAP[pageId]?.actions.map(a => a.id) ?? [];

/** Permissions complètes — ce que reçoit un admin. */
export const FULL_PERMISSIONS = (): Record<string, string[]> =>
  Object.fromEntries(PERMISSION_PAGES.map(p => [p.id, p.actions.map(a => a.id)]));

/**
 * Garde-fou : la sidebar et le catalogue de permissions doivent lister les
 * mêmes pages. Renvoie les identifiants présents d'un côté seulement.
 */
export const findPermissionDrift = () => {
  const sidebar = new Set(SIDEBAR_ITEMS.map(i => i.id));
  const perms = new Set(PERMISSION_PAGES.map(p => p.id));
  return {
    missingFromPermissions: [...sidebar].filter(id => !perms.has(id)),
    missingFromSidebar: [...perms].filter(id => !sidebar.has(id)),
  };
};
