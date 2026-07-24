import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, X } from 'lucide-react';
import { SIDEBAR_ITEMS } from '../constants';
import { Language } from '../types';
import { DatabaseService } from '../services/DatabaseService';

interface SidebarProps {
  lang: Language;
  isVisible: boolean;
  setIsVisible: (val: boolean) => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  alertsCount?: number;
  webOrdersCount?: number;
  /**
   * Onglets autorisés pour l'utilisateur connecté.
   * `null` (ou absent) = administrateur : tous les onglets sont affichés.
   * Sinon seuls les onglets listés apparaissent — c'est ce que l'admin a
   * coché dans l'écran « Permissions » de la page Équipe.
   */
  allowedTabs?: string[] | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  lang, isVisible, setIsVisible, onLogout, activeTab, setActiveTab,
  alertsCount = 0, webOrdersCount = 0, allowedTabs = null
}) => {
  const isRtl = lang === 'ar';

  // Un employé ne voit que les onglets que l'admin lui a accordés.
  const visibleItems = allowedTabs
    ? SIDEBAR_ITEMS.filter(item => allowedTabs.includes(item.id))
    : SIDEBAR_ITEMS;
  const [agencyData, setAgencyData] = useState({
    name: 'AutoFutur',
    logo: '',
  });

  // Load agency data from database
  useEffect(() => {
    const loadAgencyData = async () => {
      try {
        const websiteSettings = await DatabaseService.getWebsiteSettings();
        setAgencyData({
          name: websiteSettings.name || 'AutoFutur',
          logo: websiteSettings.logo || '',
        });
      } catch (error) {
        console.error('Error loading agency data:', error);
        // Fallback to default values
        setAgencyData({
          name: 'AutoFutur',
          logo: '',
        });
      }
    };

    loadAgencyData();
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          initial={{ x: isRtl ? '100%' : '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isRtl ? '100%' : '-100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col ltr:left-0 rtl:right-0 lg:static lg:h-screen lg:sticky lg:top-0"
          style={{
            [isRtl ? 'right' : 'left']: 0,
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            borderRight: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lift)',
          }}
        >
          <div
            className="p-8 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{
                  border: '2px solid var(--color-vel-border-gold)',
                  boxShadow: '0 4px 14px var(--color-gold-glow)',
                }}
              >
                {agencyData.logo ? (
                  <img
                    src={agencyData.logo}
                    alt="Agency Logo"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    className="font-black text-xl italic w-full h-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-gold-light), var(--color-gold))',
                      color: '#0A0A0B',
                    }}
                  >
                    A
                  </span>
                )}
              </div>
              <span className="text-xl font-black tracking-tighter uppercase">
                {agencyData.name.split(' ').slice(0, 3).join(' ').split(' ')[0]}
                <span style={{ color: 'var(--color-gold)' }}>
                  {agencyData.name.split(' ').slice(0, 3).join(' ').split(' ').slice(1).join(' ')}
                </span>
              </span>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="btn-icon btn-icon-gold lg:hidden"
              aria-label={lang === 'fr' ? 'Fermer le menu' : 'إغلاق القائمة'}
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-1.5 custom-scrollbar">
            {visibleItems.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: isRtl ? 12 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * index, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ x: isRtl ? -3 : 3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 1024) {
                    setIsVisible(false);
                  }
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl transition-colors duration-200 group relative cursor-pointer"
                style={
                  activeTab === item.id
                    ? {
                        background: 'var(--color-gold-soft)',
                        border: '1px solid var(--color-vel-border-gold)',
                        color: 'var(--color-gold)',
                      }
                    : {
                        border: '1px solid transparent',
                        color: 'var(--color-text-muted)',
                      }
                }
              >
                {/* Liseré doré de l'onglet actif */}
                {activeTab === item.id && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-y-2 w-1 rounded-full"
                    style={{
                      [isRtl ? 'right' : 'left']: '-0.25rem',
                      background: 'linear-gradient(180deg, var(--color-gold-light), var(--color-gold))',
                    }}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span
                  className={`text-xl shrink-0 transition-transform duration-300 ${
                    activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: activeTab === item.id ? 'var(--color-text)' : 'inherit' }}
                >
                  {item.label[lang]}
                </span>

                {/* Compteur d'alertes de maintenance (onglet Tableau de bord) */}
                {item.id === 'dashboard' && alertsCount > 0 && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                    title={lang === 'fr' ? `${alertsCount} alerte(s) de maintenance` : `${alertsCount} تنبيه صيانة`}
                  >
                    {/* Halo pulsant */}
                    <motion.span
                      className="absolute inline-flex h-6 w-6 rounded-full bg-red-500/40"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    {/* Pastille avec le nombre */}
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="relative min-w-[22px] h-[22px] px-1.5 flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-500 text-white text-[11px] font-black rounded-full shadow-lg shadow-red-500/50 ring-2 ring-white"
                    >
                      {alertsCount > 99 ? '99+' : alertsCount}
                    </motion.span>
                  </span>
                )}

                {/* Compteur des nouvelles commandes du site (onglet Website commandes) */}
                {item.id === 'web-orders' && webOrdersCount > 0 && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                    title={lang === 'fr' ? 'Nouvelles commandes du site en attente' : 'طلبات جديدة من الموقع في الانتظار'}
                  >
                    {/* Halo pulsant */}
                    <motion.span
                      className="absolute inline-flex h-6 w-6 rounded-full bg-indigo-500/40"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    {/* Pastille avec le nombre */}
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="relative min-w-[22px] h-[22px] px-1.5 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-[11px] font-black rounded-full shadow-lg shadow-indigo-500/50 ring-2 ring-white"
                    >
                      {webOrdersCount > 99 ? '99+' : webOrdersCount}
                    </motion.span>
                  </span>
                )}
              </motion.button>
            ))}
          </nav>

          <div
            className="p-6"
            style={{
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}
          >
            <motion.button
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              onClick={onLogout}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl transition-colors font-bold uppercase tracking-widest text-xs cursor-pointer"
              style={{
                color: 'var(--color-act-delete)',
                border: '1px solid transparent',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <LogOut size={18} />
              <span>
                {lang === 'fr' ? 'Déconnexion' : 'تسجيل الخروج'}
              </span>
            </motion.button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
