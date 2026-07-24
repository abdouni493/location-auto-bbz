import React from 'react';
import { motion } from 'motion/react';
import { Globe, Menu, Search, Monitor } from 'lucide-react';
import { Language, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  user: User;
  lang: Language;
  setLang: (lang: Language) => void;
  toggleSidebar: () => void;
  onWebsiteToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, lang, setLang, toggleSidebar, onWebsiteToggle }) => {
  const t = TRANSLATIONS[lang];

  return (
    <header
      className="h-20 px-8 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 82%, transparent)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-6">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleSidebar}
          className="btn-icon btn-icon-gold lg:hidden"
          aria-label={lang === 'fr' ? 'Ouvrir le menu' : 'فتح القائمة'}
        >
          <Menu size={20} />
        </motion.button>

        <div
          className="flex items-center gap-3 px-4 py-2 rounded-xl w-64 md:w-80 group transition-all focus-within:ring-2"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-soft)',
          }}
        >
          <Search size={16} style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder={lang === 'fr' ? 'Rechercher...' : 'بحث...'}
            className="bg-transparent border-none outline-none text-sm w-full font-medium"
            style={{ color: 'var(--color-text)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Bascule clair / sombre */}
        <ThemeToggle lang={lang} />

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-soft)',
            color: 'var(--color-text)',
          }}
        >
          <Globe size={16} style={{ color: 'var(--color-gold)' }} />
          {t.changeLang}
        </motion.button>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onWebsiteToggle}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
          style={{
            background: 'var(--color-gold-soft)',
            border: '1px solid var(--color-vel-border-gold)',
            color: 'var(--color-gold)',
          }}
          title={lang === 'fr' ? 'Aperçu du site web' : 'عرض الموقع'}
        >
          <Monitor size={16} />
          {{ fr: 'Aperçu', ar: 'عرض' }[lang]}
        </motion.button>

        <div className="h-8 w-px" style={{ background: 'var(--color-border)' }} />

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold uppercase tracking-tighter" style={{ color: 'var(--color-text)' }}>
              {user.name}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-gold)' }}>
              {user.role}
            </p>
          </div>
          <div className="relative">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-10 h-10 rounded-full p-0.5 object-cover"
                style={{ border: '1px solid var(--color-vel-border-gold)' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                style={{
                  background: 'linear-gradient(135deg, var(--color-gold-light), var(--color-gold))',
                  color: '#0A0A0B',
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
              style={{
                background: 'var(--color-act-success)',
                border: '2px solid var(--color-surface)',
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
};
