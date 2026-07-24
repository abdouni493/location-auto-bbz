import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Mail, Lock, UserIcon, Eye, EyeOff, Globe, ArrowRight,
  ShieldCheck, AlertCircle, CarFront, CalendarClock, BarChart3,
} from 'lucide-react';
import { supabase } from '../supabase';
import { Language, UserRole, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { DatabaseService } from '../services/DatabaseService';
import { sessionService } from '../utils/sessionService';
import { ThemeToggle } from './ThemeToggle';

interface LoginProps {
  lang: Language;
  // now emit full user object once authenticated
  onLogin: (user: User) => void;
}

interface AdminCount {
  count: number;
}

interface AgencyBranding {
  logo: string;
  name: string;
}

export const Login: React.FC<LoginProps> = ({ lang, onLogin }) => {
  const t = TRANSLATIONS[lang];
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agencyBranding, setAgencyBranding] = useState<AgencyBranding>({
    logo: '',
    name: 'AutoLocation'
  });

  useEffect(() => {
    const checkAdmin = async () => {
      // if we stored a flag locally, skip the network request
      if (localStorage.getItem('signupDone')) {
        setAdminExists(true);
      }
      
      try {
        const { data, error } = await supabase
          .from('admin_count')
          .select('count')
          .single();
        if (data && (data as any).count > 0) {
          setAdminExists(true);
        }
      } catch (err) {
        console.warn('Error checking admin:', err);
      }
    };
    
    const loadAgencyBranding = async () => {
      try {
        const settings = await DatabaseService.getWebsiteSettings();
        if (settings) {
          setAgencyBranding({
            logo: settings.logo || '',
            name: settings.name || 'AutoLocation'
          });
        }
      } catch (err) {
        console.warn('Error loading agency branding:', err);
      }
    };
    
    checkAdmin();
    loadAgencyBranding();
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[Login] ======= LOGIN/SIGNUP ATTEMPT STARTED at ${timestamp} =======`);
    
    // Prevent double submissions
    if (isSubmitting) {
      console.log('[Login] Form already submitting, ignoring duplicate submission');
      return;
    }
    
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      // SIGNUP FLOW - Always use Supabase Auth
      if (isSigningUp) {
        console.log('[Login] === SIGNUP MODE ===');
        console.log('[Login] Creating admin account via RPC...');
        // Create the first admin account directly in Supabase Auth (auth.users)
        // through the SECURITY DEFINER function create_admin_account (see main.sql).
        // It also creates the profiles row (role='admin') and the email is
        // pre-confirmed, so the admin can sign in immediately. It only succeeds
        // while NO admin exists yet.
        const { data: adminResult, error: adminError } = await supabase.rpc('create_admin_account', {
          p_email: email,
          p_password: password,
          p_username: username,
        });

        if (adminError) {
          console.log('[Login] create_admin_account RPC error:', adminError.message);
          setErrorMessage(
            lang === 'fr'
              ? "Impossible de créer le compte administrateur. Vérifiez que le schéma de base de données (main.sql) a bien été exécuté."
              : 'تعذّر إنشاء حساب المسؤول. تأكد من تنفيذ مخطط قاعدة البيانات (main.sql).'
          );
          setIsSubmitting(false);
          return;
        }

        if (adminResult && adminResult.success === false) {
          const reason: string = adminResult.error || '';
          if (reason === 'ADMIN_EXISTS') {
            // An admin already exists → hide the create-admin option for good.
            localStorage.setItem('signupDone', 'true');
            setAdminExists(true);
            setIsSigningUp(false);
            setErrorMessage(
              lang === 'fr'
                ? 'Un administrateur existe déjà. Connectez-vous avec votre email.'
                : 'يوجد مسؤول بالفعل. سجّل الدخول ببريدك الإلكتروني.'
            );
          } else if (reason.includes('EMAIL_ALREADY_EXISTS')) {
            setErrorMessage(
              lang === 'fr' ? 'Cet email est déjà utilisé.' : 'هذا البريد الإلكتروني مُستخدم بالفعل.'
            );
          } else if (reason.includes('PASSWORD_TOO_SHORT')) {
            setErrorMessage(
              lang === 'fr'
                ? 'Mot de passe trop court (6 caractères minimum).'
                : 'كلمة المرور قصيرة جدًا (٦ أحرف على الأقل).'
            );
          } else {
            setErrorMessage(
              reason || (lang === 'fr' ? 'Erreur lors de la création du compte.' : 'خطأ أثناء إنشاء الحساب.')
            );
          }
          setIsSubmitting(false);
          return;
        }

        // Admin created successfully → hide the "create admin account" option
        // permanently so no second admin can be created from the login page.
        localStorage.setItem('signupDone', 'true');
        setAdminExists(true);

        // automatically sign in the user
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword(
          { email, password }
        );
        if (loginError) {
          console.log('[Login] Auto-signin after signup error:', loginError.message);
          setErrorMessage(loginError.message);
          setIsSubmitting(false);
          return;
        }
        if (loginData.session) {
          const u = loginData.user;
          const role = (u.user_metadata?.role as UserRole) || 'admin';
          const name = (u.user_metadata?.username as string) || u.email || '';
          
          console.log('[Login] === SIGNUP SUCCESSFUL ===');
          console.log('[Login] Signup user:', { name, email: u.email, role });
          console.log('[Login] Session token length:', loginData.session.access_token.length);
          console.log('[Login] localStorage after signup:', {
            has_token: !!localStorage.getItem('supabase.auth.token'),
            has_signup_done: !!localStorage.getItem('signupDone')
          });
          
          // Save session
          await sessionService.createSession(
            loginData.session.access_token,
            loginData.session.refresh_token,
            loginData.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
            u.id,
            u.email || '',
            role,
            name
          );
          
          // CRITICAL: Clear all SDK session data to prevent auto-refresh
          console.log('[Login] Clearing SDK session data to prevent auto-refresh...');
          localStorage.removeItem('supabase.auth.token');
          sessionStorage.clear();
          
          // Clear form
          setEmail('');
          setPassword('');
          setUsername('');
          
          console.log('[Login] Calling onLogin callback...');
          onLogin({ name, email: u.email || '', role, avatar: '' });
        }
        setIsSubmitting(false);
        return;
      }

      // LOGIN FLOW - Determine auth method based on input format
      const credential = email.trim();
      const isEmailInput = credential.includes('@');

      if (!credential || !password) {
        console.log('[Login] Missing credentials - email:', !!credential, 'password:', !!password);
        setErrorMessage(lang === 'fr' 
          ? 'Veuillez entrer vos identifiants.' 
          : 'الرجاء إدخال بيانات الدخول.');
        setIsSubmitting(false);
        return;
      }

      // LOGIN FLOW - All users (admin and workers) use Supabase Auth with email
      // Users must provide email and password to login
      console.log('[Login] === AUTHENTICATION ATTEMPT ===');
      console.log('[Login] Credentials provided - email format:', isEmailInput);
      
      try {
        // For email input: try Supabase Auth first, then fall back to worker RPC
        if (isEmailInput) {
          console.log('[Login] Email authentication for:', credential);
          
          // Try Supabase Auth first (for admin accounts)
          const result = await supabase.auth.signInWithPassword({
            email: credential,
            password
          });
          
          if (result.error) {
            console.log('[Login] Supabase Auth failed:', result.error.message);
            // If Supabase Auth fails, try worker RPC login
            console.log('[Login] Trying worker login via RPC...');
            
            const { data: loginResult, error: rpcError } = await supabase.rpc('login_worker', {
              p_email_or_username: credential,
              p_password: password
            });

            if (rpcError || !loginResult?.success) {
              console.log('[Login] Worker login also failed:', rpcError?.message || loginResult?.error);
              setErrorMessage(lang === 'fr' 
                ? 'Email ou mot de passe incorrect.' 
                : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
              setIsSubmitting(false);
              return;
            }

            // Worker RPC login successful
            const worker = loginResult.worker;
            const workerRole = (worker.type as UserRole) || 'worker';
            
            console.log('[Login] === WORKER LOGIN SUCCESSFUL ===');
            console.log('[Login] Worker authenticated:', { name: worker.full_name, email: worker.email, role: workerRole });
            
            // Save worker session to database
            const sessionResult = await sessionService.createSession(
              `worker_token_${Date.now()}`,
              undefined,
              Math.floor(Date.now() / 1000) + (24 * 60 * 60),
              worker.id || `worker_${Date.now()}`,
              worker.email || '',
              workerRole,
              worker.full_name
            );
            
            console.log('[Login] Session saved:', !!sessionResult);
            
            // Clear form
            setEmail('');
            setPassword('');
            setUsername('');
            
            console.log('[Login] Calling onLogin callback...');
            onLogin({
              name: worker.full_name,
              email: worker.email || '',
              role: workerRole,
              avatar: worker.profile_photo || ''
            });
            return;
          }

          if (result.data?.session) {
            const u = result.data.user;
            const role = (u.user_metadata?.role as UserRole) || 'admin';
            const name = (u.user_metadata?.username as string) || u.user_metadata?.full_name || u.email || '';
            
            console.log('[Login] === ADMIN LOGIN SUCCESSFUL ===');
            console.log('[Login] Admin authenticated:', { name, email: u.email, role });
            
            // Save session to database using new session service
            console.log('[Login] Saving session to database...');
            await sessionService.createSession(
              result.data.session.access_token,
              result.data.session.refresh_token,
              result.data.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
              u.id,
              u.email || '',
              role,
              name
            );
            
            // CRITICAL: Clear all SDK session data to prevent auto-refresh
            console.log('[Login] Clearing SDK session data to prevent auto-refresh...');
            localStorage.removeItem('supabase.auth.token');
            sessionStorage.clear();
            
            // Clear form
            setEmail('');
            setPassword('');
            setUsername('');
            
            console.log('[Login] Calling onLogin callback...');
            onLogin({ name, email: u.email || '', role, avatar: '' });
            return;
          }
        } else {
          // For non-email input (username): show error message
          console.log('[Login] Username-based login no longer supported. Please use email.');
          setErrorMessage(lang === 'fr' 
            ? 'Veuillez utiliser votre email pour vous connecter.' 
            : 'يرجى استخدام بريدك الإلكتروني للدخول.');
          setIsSubmitting(false);
          return;
        }
      } catch (error) {
        console.log('[Login] Authentication exception:', error);
        setErrorMessage(lang === 'fr' 
          ? 'Une erreur est survenue lors de la connexion.' 
          : 'حدث خطأ أثناء تسجيل الدخول.');
        setIsSubmitting(false);
        return;
      }
    } catch (error) {
      console.log('[Login] === UNEXPECTED ERROR ===');
      console.log('[Login] Error:', error);
      setErrorMessage(lang === 'fr' 
        ? 'Une erreur est survenue lors de la connexion.' 
        : 'حدث خطأ أثناء تسجيل الدخول.');
      setIsSubmitting(false);
    }
  };

  /** Nom d'agence affiché : 3 mots au maximum, comme sur le reste de l'app. */
  const shortName = agencyBranding.name.split(' ').slice(0, 3).join(' ');

  /** Arguments montrés sur le panneau de gauche (desktop uniquement). */
  const highlights = [
    {
      icon: CarFront,
      fr: 'Flotte & maintenance', ar: 'الأسطول والصيانة',
      frSub: 'Vidange, assurance et contrôle technique suivis au kilomètre près.',
      arSub: 'متابعة الزيت والتأمين والفحص الفني بدقة.',
    },
    {
      icon: CalendarClock,
      fr: 'Réservations en direct', ar: 'الحجوزات المباشرة',
      frSub: 'Planificateur, contrats et commandes du site au même endroit.',
      arSub: 'المخطط والعقود وطلبات الموقع في مكان واحد.',
    },
    {
      icon: BarChart3,
      fr: 'Revenus & rapports', ar: 'الإيرادات والتقارير',
      frSub: 'Gains par véhicule, dépenses et bénéfice net en temps réel.',
      arSub: 'الأرباح لكل مركبة والمصاريف والربح الصافي مباشرة.',
    },
  ];

  return (
    <div
      className="min-h-screen w-full flex items-stretch"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* ══════════════════════ PANNEAU GAUCHE — vitrine ══════════════════════
          Masqué sous lg : sur mobile, seul le formulaire compte. */}
      <aside
        className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative overflow-hidden flex-col justify-between p-12 xl:p-16"
        style={{
          background: 'linear-gradient(160deg, var(--color-surface), var(--color-bg-alt) 55%, var(--color-surface-2))',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        {/* Halos dorés lents, purement décoratifs */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-24 w-[30rem] h-[30rem] rounded-full"
          style={{ background: 'var(--color-gold-glow)', filter: 'blur(120px)' }}
          animate={{ x: [0, 60, 0], y: [0, 40, 0], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -bottom-48 -right-20 w-[34rem] h-[34rem] rounded-full"
          style={{ background: 'var(--color-gold-glow)', filter: 'blur(140px)' }}
          animate={{ x: [0, -50, 0], y: [0, -30, 0], opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Trame très discrète */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-gold) 1px, transparent 1px), linear-gradient(90deg, var(--color-gold) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-center gap-4"
        >
          {agencyBranding.logo ? (
            <img
              src={agencyBranding.logo}
              alt=""
              className="h-14 w-14 object-contain rounded-2xl"
              style={{ border: '1px solid var(--color-vel-border-gold)', background: 'var(--color-gold-soft)' }}
            />
          ) : (
            <span
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'var(--color-gold-soft)', border: '1px solid var(--color-vel-border-gold)' }}
            >
              🚘
            </span>
          )}
          <div className="min-w-0">
            <p className="font-display font-black text-xl tracking-tight uppercase truncate" style={{ color: 'var(--color-text)' }}>
              {shortName}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em]" style={{ color: 'var(--color-gold)' }}>
              {lang === 'fr' ? 'Espace gestion' : 'مساحة الإدارة'}
            </p>
          </div>
        </motion.div>

        <div className="relative space-y-10">
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-4xl xl:text-5xl font-black leading-[1.05] tracking-tighter"
            style={{ color: 'var(--color-text)' }}
          >
            {lang === 'fr' ? (
              <>Toute votre agence,<br />
                <span style={{ color: 'var(--color-gold)' }}>sur un seul écran.</span></>
            ) : (
              <>وكالتك بالكامل،<br />
                <span style={{ color: 'var(--color-gold)' }}>على شاشة واحدة.</span></>
            )}
          </motion.h2>

          <ul className="space-y-5">
            {highlights.map((h, i) => (
              <motion.li
                key={h.fr}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.09, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-4"
              >
                <span
                  className="mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-gold-soft)', border: '1px solid var(--color-vel-border-gold)', color: 'var(--color-gold)' }}
                >
                  <h.icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                    {lang === 'fr' ? h.fr : h.ar}
                  </p>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {lang === 'fr' ? h.frSub : h.arSub}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="relative flex items-center gap-2 text-[11px] font-semibold"
          style={{ color: 'var(--color-text-dim)' }}
        >
          <ShieldCheck size={14} style={{ color: 'var(--color-gold)' }} />
          {lang === 'fr'
            ? 'Connexion chiffrée — accès réservé au personnel autorisé.'
            : 'اتصال مُشفّر — الدخول مخصص للموظفين المصرح لهم.'}
        </motion.p>
      </aside>

      {/* ══════════════════════ PANNEAU DROIT — formulaire ═══════════════════ */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:px-10 relative">
        {/* Bascule de thème, discrète, en haut à droite */}
        <div className="absolute top-6 right-6">
          <ThemeToggle lang={lang} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[26rem]"
        >
          {/* En-tête — le logo n'apparaît ici que sur mobile (panneau masqué) */}
          <div className="mb-9">
            {agencyBranding.logo && (
              <motion.img
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 20 }}
                src={agencyBranding.logo}
                alt=""
                className="lg:hidden h-16 w-16 object-contain rounded-2xl mb-6"
                style={{ border: '1px solid var(--color-vel-border-gold)', background: 'var(--color-gold-soft)' }}
              />
            )}

            <p className="text-[10px] font-black uppercase tracking-[0.32em] mb-2" style={{ color: 'var(--color-gold)' }}>
              {isSigningUp
                ? (lang === 'fr' ? 'Premier démarrage' : 'الإعداد الأول')
                : (lang === 'fr' ? 'Bon retour' : 'مرحبًا بعودتك')}
            </p>
            <h1 className="font-display text-3xl sm:text-[2.1rem] font-black tracking-tighter leading-tight" style={{ color: 'var(--color-text)' }}>
              {isSigningUp
                ? (lang === 'fr' ? 'Créer le compte administrateur' : 'إنشاء حساب المسؤول')
                : (lang === 'fr' ? 'Connexion à votre espace' : 'تسجيل الدخول إلى مساحتك')}
            </h1>
            <p className="text-sm mt-2.5 lg:hidden font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {shortName}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Nom d'utilisateur — création du tout premier compte uniquement */}
            {isSigningUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.35 }}
              >
                <label className="label-saas">{t.username}</label>
                <div className="relative group">
                  <UserIcon
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none"
                    style={{ color: 'var(--color-text-dim)' }}
                    size={17}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-saas pl-12 py-3"
                    placeholder="Jean Dupont"
                  />
                </div>
              </motion.div>
            )}

            <div>
              <label className="label-saas">
                {isSigningUp
                  ? t.email
                  : (lang === 'fr' ? 'Adresse email' : 'البريد الإلكتروني')}
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none"
                  style={{ color: 'var(--color-text-dim)' }}
                  size={17}
                />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="input-saas pl-12 py-3"
                  placeholder="vous@agence.com"
                />
              </div>
            </div>

            <div>
              <label className="label-saas">{t.password}</label>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none"
                  style={{ color: 'var(--color-text-dim)' }}
                  size={17}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSigningUp ? 'new-password' : 'current-password'}
                  className="input-saas pl-12 pr-12 py-3"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword
                    ? (lang === 'fr' ? 'Masquer le mot de passe' : 'إخفاء كلمة المرور')
                    : (lang === 'fr' ? 'Afficher le mot de passe' : 'إظهار كلمة المرور')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-dim)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-gold)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-dim)')}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="flex items-start gap-2.5 rounded-xl p-3.5 text-sm font-medium"
                style={{
                  background: 'color-mix(in srgb, var(--color-act-delete) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-act-delete) 35%, transparent)',
                  color: 'var(--color-act-delete)',
                }}
              >
                <AlertCircle size={17} className="shrink-0 mt-px" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: 0.985 }}
              className="btn-saas-primary w-full text-sm py-3.5 mt-1"
            >
              {isSubmitting ? (
                <>
                  <motion.span
                    className="w-4 h-4 rounded-full border-2 border-current border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  {isSigningUp ? t.signup : t.login}…
                </>
              ) : (
                <>
                  {isSigningUp ? t.signup : t.login}
                  <ArrowRight size={17} />
                </>
              )}
            </motion.button>
          </form>

          {/* Séparateur */}
          <div className="flex items-center gap-4 my-7">
            <span className="h-px flex-1" style={{ background: 'var(--color-border-soft)' }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--color-text-dim)' }}>
              {lang === 'fr' ? 'ou' : 'أو'}
            </span>
            <span className="h-px flex-1" style={{ background: 'var(--color-border-soft)' }} />
          </div>

          {/* Voir le site public sans se connecter */}
          <motion.button
            type="button"
            onClick={() => navigate('/website')}
            whileTap={{ scale: 0.985 }}
            className="btn-saas-outline w-full text-sm py-3.5"
          >
            <Globe size={17} />
            {lang === 'fr' ? 'Voir le site web' : 'مشاهدة الموقع الإلكتروني'}
          </motion.button>

          {/* Création du tout premier administrateur */}
          {!adminExists && !isSigningUp && (
            <div className="text-center mt-7">
              <button
                type="button"
                onClick={() => setIsSigningUp(true)}
                className="text-sm font-bold transition-opacity hover:opacity-75 cursor-pointer"
                style={{ color: 'var(--color-gold)' }}
              >
                {t.signup} →
              </button>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-dim)' }}>
                {lang === 'fr' ? '(première connexion uniquement)' : '(للاتصال الأول فقط)'}
              </p>
            </div>
          )}

          {isSigningUp && (
            <div className="text-center mt-7">
              <button
                type="button"
                onClick={() => { setIsSigningUp(false); setErrorMessage(''); }}
                className="text-sm font-bold transition-opacity hover:opacity-75 cursor-pointer"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ← {lang === 'fr' ? 'Retour à la connexion' : 'العودة لتسجيل الدخول'}
              </button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};
