import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Loader2, User, Briefcase, Wallet, KeyRound, Plus, Check, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';
import type { Language, Worker, WorkerRole } from '../types';
import { RoleService } from '../services/permissionsService';

interface WorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (worker: Partial<Worker>) => void | Promise<void>;
  worker?: Worker | null;
  lang: Language;
}

const emptyWorker = (): Partial<Worker> => ({
  fullName: '',
  dateOfBirth: '',
  idCardNumber: '',
  phone: '',
  email: '',
  address: '',
  roleId: '',
  roleName: '',
  startDate: new Date().toISOString().split('T')[0],
  isPaid: true,
  paymentType: 'monthly',
  baseSalary: 0,
  hasAccount: false,
  username: '',
  password: '',
});

/**
 * Création / modification d'un employé.
 *
 * Quatre blocs indépendants :
 *   1. informations personnelles ;
 *   2. poste (rôle libre, créable à la volée) et date d'entrée ;
 *   3. rémunération — un employé peut ne PAS être rémunéré ;
 *   4. compte de connexion — optionnel ; s'il est activé, un vrai compte
 *      Supabase Auth est créé (RPC `create_worker_account`) et l'employé se
 *      connecte ensuite depuis la page de login habituelle.
 *
 * Un employé est toujours créé SANS permission : elles se règlent ensuite
 * depuis l'action « Permissions » de sa carte.
 */
export const WorkerModal: React.FC<WorkerModalProps> = ({ isOpen, onClose, onSave, worker, lang }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const [form, setForm] = useState<Partial<Worker>>(emptyWorker());
  const [roles, setRoles] = useState<WorkerRole[]>([]);
  const [newRole, setNewRole] = useState('');
  const [showRoleInput, setShowRoleInput] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // En modification, le mot de passe repart vide : le laisser tel quel
    // signifie « ne pas changer ».
    setForm(worker ? { ...emptyWorker(), ...worker, password: '' } : emptyWorker());
    setError(null);
    RoleService.getAll().then(setRoles).catch(() => setRoles([]));
  }, [worker, isOpen]);

  if (!isOpen) return null;

  const set = (k: keyof Worker, v: any) => setForm(p => ({ ...p, [k]: v }));

  const addRole = async () => {
    const name = newRole.trim();
    if (!name) return;
    setCreatingRole(true);
    try {
      const role = await RoleService.create(name);
      setRoles(prev => (prev.some(r => r.id === role.id) ? prev : [...prev, role]));
      set('roleId', role.id);
      set('roleName', role.name);
      setNewRole('');
      setShowRoleInput(false);
    } catch (err: any) {
      setError(err?.message || T("Le rôle n'a pas pu être créé.", 'تعذر إنشاء الدور.'));
    } finally {
      setCreatingRole(false);
    }
  };

  const submit = async () => {
    if (!form.fullName?.trim()) {
      setError(T('Le nom complet est obligatoire.', 'الاسم الكامل إلزامي.'));
      return;
    }
    if (!form.phone?.trim()) {
      setError(T('Le numéro de téléphone est obligatoire.', 'رقم الهاتف إلزامي.'));
      return;
    }
    if (form.hasAccount) {
      if (!form.email?.trim()) {
        setError(T("L'email est obligatoire pour activer le compte.", 'البريد إلزامي لتفعيل الحساب.'));
        return;
      }
      // À la CRÉATION seulement : un mot de passe est indispensable.
      if (!worker && (!form.password || form.password.length < 6)) {
        setError(T('Mot de passe : 6 caractères minimum.', 'كلمة المرور: 6 أحرف على الأقل.'));
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err?.message || T("L'enregistrement a échoué.", 'فشل الحفظ.'));
    } finally {
      setSaving(false);
    }
  };

  const section = (icon: React.ReactNode, title: string, children: React.ReactNode) => (
    <section className="space-y-4">
      <h3
        className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2.5"
        style={{ color: 'var(--color-gold)' }}
      >
        <span className="p-1.5 rounded-lg" style={{ background: 'var(--color-gold-soft)' }}>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );

  /** Interrupteur réutilisé par « rémunéré » et « compte de connexion ». */
  const toggle = (on: boolean, onClick: () => void, title: string, hint: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 p-4 rounded-xl text-left cursor-pointer"
      style={{
        background: on ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
        border: `1px solid ${on ? 'var(--color-gold)' : 'var(--color-border-soft)'}`,
      }}
    >
      <span className="min-w-0">
        <span className="block font-bold text-sm" style={{ color: on ? 'var(--color-gold)' : 'var(--color-text)' }}>
          {title}
        </span>
        <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{hint}</span>
      </span>
      <span
        className="relative w-12 h-6 rounded-full shrink-0 transition-colors"
        style={{
          background: on ? 'var(--color-gold)' : 'var(--color-surface-3)',
          border: '1px solid var(--color-border-soft)',
        }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{
            left: on ? 'calc(100% - 1.375rem)' : '0.125rem',
            background: on ? '#0A0A0B' : 'var(--color-text-muted)',
          }}
        />
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lift)' }}
      >
        <header
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))', color: '#0A0A0B' }}
        >
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter">
              {worker ? T("Modifier l'employé", 'تعديل الموظف') : T('Nouvel employé', 'موظف جديد')}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-0.5">
              {T('Équipe & permissions', 'الفريق والصلاحيات')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/10 cursor-pointer">
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar" style={{ background: 'var(--color-bg)' }}>
          {/* ── 1. Informations personnelles ── */}
          {section(<User size={14} />, T('Informations personnelles', 'المعلومات الشخصية'), (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label-saas">{T('Nom complet', 'الاسم الكامل')} *</label>
                <input value={form.fullName ?? ''} onChange={e => set('fullName', e.target.value)}
                       className="input-saas" placeholder={T('ex : Karim Benali', 'مثال: كريم بن علي')} autoFocus />
              </div>
              <div>
                <label className="label-saas">{T('Date de naissance', 'تاريخ الميلاد')}</label>
                <input type="date" value={form.dateOfBirth ?? ''} onChange={e => set('dateOfBirth', e.target.value)}
                       className="input-saas" />
              </div>
              <div>
                <label className="label-saas">
                  {T("N° de pièce d'identité", 'رقم بطاقة الهوية')}
                  <span style={{ color: 'var(--color-text-dim)' }}> ({T('facultatif', 'اختياري')})</span>
                </label>
                <input value={form.idCardNumber ?? ''} onChange={e => set('idCardNumber', e.target.value)}
                       className="input-saas" />
              </div>
              <div>
                <label className="label-saas">{T('Téléphone', 'الهاتف')} *</label>
                <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)}
                       className="input-saas" placeholder="0555 00 00 00" />
              </div>
              <div>
                <label className="label-saas">{T('Adresse', 'العنوان')}</label>
                <input value={form.address ?? ''} onChange={e => set('address', e.target.value)} className="input-saas" />
              </div>
            </div>
          ))}

          {/* ── 2. Poste ── */}
          {section(<Briefcase size={14} />, T('Poste', 'المنصب'), (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-saas">{T('Rôle', 'الدور')}</label>
                <div className="flex gap-2">
                  <select
                    value={form.roleId ?? ''}
                    onChange={e => {
                      const r = roles.find(x => x.id === e.target.value);
                      set('roleId', e.target.value);
                      set('roleName', r?.name ?? '');
                    }}
                    className="input-saas flex-1"
                  >
                    <option value="">{T('— Choisir un rôle —', '— اختر دورًا —')}</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowRoleInput(v => !v)}
                    className="btn-icon btn-icon-gold shrink-0"
                    title={T('Créer un rôle', 'إنشاء دور')}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <AnimatePresence>
                  {showRoleInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 mt-2">
                        <input
                          value={newRole}
                          onChange={e => setNewRole(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
                          className="input-saas flex-1"
                          placeholder={T('Nom du nouveau rôle', 'اسم الدور الجديد')}
                        />
                        <button type="button" onClick={addRole} disabled={creatingRole || !newRole.trim()}
                                className="btn-saas-primary !px-4">
                          {creatingRole ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="label-saas">{T('Date de début de travail', 'تاريخ بدء العمل')}</label>
                <input type="date" value={form.startDate ?? ''} onChange={e => set('startDate', e.target.value)}
                       className="input-saas" />
              </div>
            </div>
          ))}

          {/* ── 3. Rémunération ── */}
          {section(<Wallet size={14} />, T('Rémunération', 'الأجر'), (
            <div className="space-y-4">
              {toggle(
                form.isPaid !== false,
                () => set('isPaid', form.isPaid === false),
                T('Cet employé est rémunéré', 'هذا الموظف يتقاضى أجرًا'),
                T('Désactivez pour un bénévole ou un stagiaire non payé.',
                  'عطّل الخيار للمتطوع أو المتدرب غير المدفوع.')
              )}

              <AnimatePresence initial={false}>
                {form.isPaid !== false && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="label-saas">{T('Type de paiement', 'نوع الدفع')}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { v: 'monthly' as const, fr: 'Par mois', ar: 'شهريًا', icon: '📅' },
                            { v: 'daily' as const,   fr: 'Par jour', ar: 'يوميًا', icon: '☀️' },
                          ]).map(o => {
                            const active = form.paymentType === o.v;
                            return (
                              <button key={o.v} type="button" onClick={() => set('paymentType', o.v)}
                                className="py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                style={{
                                  background: active ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
                                  border: `1px solid ${active ? 'var(--color-gold)' : 'var(--color-border-soft)'}`,
                                  color: active ? 'var(--color-gold)' : 'var(--color-text-muted)',
                                }}>
                                {o.icon} {isFr ? o.fr : o.ar}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="label-saas">
                          {form.paymentType === 'daily'
                            ? T('Montant par jour (DA)', 'المبلغ اليومي (دج)')
                            : T('Salaire mensuel (DA)', 'الراتب الشهري (دج)')}
                        </label>
                        <input type="number" min={0} value={form.baseSalary ?? 0}
                               onChange={e => set('baseSalary', Number(e.target.value) || 0)}
                               className="input-saas" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* ── 4. Compte de connexion ── */}
          {section(<KeyRound size={14} />, T('Compte de connexion', 'حساب الدخول'), (
            <div className="space-y-4">
              {toggle(
                form.hasAccount === true,
                () => set('hasAccount', !form.hasAccount),
                T("Autoriser la connexion à l'application", 'السماح بالدخول إلى التطبيق'),
                T("Un compte est créé : l'employé se connecte avec son email et son mot de passe.",
                  'يُنشأ حساب: يدخل الموظف ببريده وكلمة المرور.')
              )}

              <AnimatePresence initial={false}>
                {form.hasAccount && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="sm:col-span-2">
                        <label className="label-saas">{T('Email de connexion', 'بريد الدخول')} *</label>
                        <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)}
                               className="input-saas" placeholder="employe@agence.dz" />
                      </div>
                      <div>
                        <label className="label-saas">{T("Nom d'utilisateur", 'اسم المستخدم')}</label>
                        <input value={form.username ?? ''} onChange={e => set('username', e.target.value)}
                               className="input-saas" />
                      </div>
                      <div>
                        <label className="label-saas">
                          {T('Mot de passe', 'كلمة المرور')} {worker ? '' : '*'}
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.password ?? ''}
                            onChange={e => set('password', e.target.value)}
                            className="input-saas pr-11"
                            placeholder={worker ? T('Laisser vide pour ne pas changer', 'اتركه فارغًا للإبقاء') : '••••••'}
                          />
                          <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute end-3 top-1/2 -translate-y-1/2 cursor-pointer"
                            style={{ color: 'var(--color-text-muted)' }}
                            aria-label={T('Afficher le mot de passe', 'إظهار كلمة المرور')}>
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Rappel : les permissions se règlent après la création */}
          {!worker && (
            <div className="flex items-start gap-2.5 p-4 rounded-xl text-xs"
                 style={{ background: 'rgba(59,130,246,0.10)', color: 'var(--color-act-edit)' }}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                {T(
                  "L'employé sera créé sans aucune permission. Utilisez ensuite l'action « Permissions » de sa carte pour choisir les pages et les boutons auxquels il a accès.",
                  'سيُنشأ الموظف بدون أي صلاحية. استخدم بعد ذلك زر « الصلاحيات » في بطاقته لاختيار الصفحات والأزرار المسموح بها.'
                )}
              </span>
            </div>
          )}

          {error && (
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-act-delete)' }}>
              <AlertTriangle size={15} /> {error}
            </p>
          )}
        </div>

        <footer className="p-5 flex gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn-saas-outline flex-1" disabled={saving}>
            {T('Annuler', 'إلغاء')}
          </button>
          <button onClick={submit} className="btn-saas-primary flex-1" disabled={saving}>
            {saving
              ? <><Loader2 size={16} className="animate-spin" />{T('Enregistrement…', 'جاري الحفظ…')}</>
              : (worker ? T('Enregistrer', 'حفظ') : T("Créer l'employé", 'إنشاء الموظف'))}
          </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default WorkerModal;
