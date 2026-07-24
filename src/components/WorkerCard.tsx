import React from 'react';
import { Worker, Language } from '../types';
import { motion } from 'motion/react';
import {
  Eye, Pencil, Trash2, Shield, Wallet, CreditCard, CalendarX, History,
  Phone, Mail, KeyRound, CalendarDays,
} from 'lucide-react';

interface WorkerCardProps {
  worker: Worker;
  index: number;
  lang: Language;
  onDetails: () => void;
  onPayment: () => void;
  onAdvance: () => void;
  onAbsence: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Ouvre l'écran de permissions (pages + boutons autorisés). */
  onPermissions?: () => void;
}

const money = (n: number) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
const fmtDate = (d?: string) => {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

/**
 * Carte d'un employé : identité, rôle, rémunération, statut du compte, puis les
 * actions (consulter, permissions, acompte, absence, paiement, historique,
 * modifier, supprimer).
 */
export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker, index, lang,
  onDetails, onPayment, onAdvance, onAbsence, onHistory, onEdit, onDelete, onPermissions,
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  // Le rôle libre prime ; sinon on retombe sur l'ancien type.
  const role = worker.roleName
    || (worker.type === 'admin' ? T('Administrateur', 'مسؤول')
      : worker.type === 'driver' ? T('Chauffeur', 'سائق')
      : T('Employé', 'موظف'));

  const paid = worker.isPaid !== false && (worker.baseSalary || 0) > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="card-gold overflow-hidden flex flex-col"
    >
      {/* ── Identité ── */}
      <header className="p-5 flex items-center gap-4" style={{ borderBottom: '1px solid var(--color-border-soft)' }}>
        <div
          className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shrink-0"
          style={{
            border: '2px solid var(--color-vel-border-gold)',
            background: 'var(--color-surface-2)',
          }}
        >
          {worker.profilePhoto ? (
            <img src={worker.profilePhoto} alt={worker.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="font-black text-lg" style={{ color: 'var(--color-gold)' }}>
              {worker.fullName?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm truncate" style={{ color: 'var(--color-text)' }} title={worker.fullName}>
            {worker.fullName}
          </h3>
          <span
            className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide"
            style={{ background: 'var(--color-gold-soft)', color: 'var(--color-gold)' }}
          >
            {role}
          </span>
        </div>

        {/* Compte de connexion actif ? */}
        <span
          className="p-1.5 rounded-lg shrink-0"
          style={{
            background: worker.hasAccount ? 'rgba(16,185,129,0.14)' : 'var(--color-surface-2)',
            color: worker.hasAccount ? 'var(--color-act-success)' : 'var(--color-text-dim)',
          }}
          title={worker.hasAccount
            ? T('Peut se connecter à l\'application', 'يمكنه الدخول إلى التطبيق')
            : T('Aucun compte de connexion', 'لا يوجد حساب دخول')}
        >
          <KeyRound size={14} />
        </span>
      </header>

      {/* ── Informations ── */}
      <div className="px-5 py-4 space-y-1.5 text-xs" style={{ borderBottom: '1px solid var(--color-border-soft)' }}>
        {worker.phone && (
          <p className="flex items-center gap-2 truncate" style={{ color: 'var(--color-text-muted)' }}>
            <Phone size={12} className="shrink-0" />{worker.phone}
          </p>
        )}
        {worker.email && (
          <p className="flex items-center gap-2 truncate" style={{ color: 'var(--color-text-muted)' }}>
            <Mail size={12} className="shrink-0" />{worker.email}
          </p>
        )}
        {worker.startDate && (
          <p className="flex items-center gap-2 truncate" style={{ color: 'var(--color-text-muted)' }}>
            <CalendarDays size={12} className="shrink-0" />
            {T('Depuis le', 'منذ')} {fmtDate(worker.startDate)}
          </p>
        )}

        <p className="flex items-center gap-2 font-bold pt-1"
           style={{ color: paid ? 'var(--color-gold)' : 'var(--color-text-dim)' }}>
          <Wallet size={12} className="shrink-0" />
          {paid
            ? `${money(worker.baseSalary)} DA / ${worker.paymentType === 'daily' ? T('jour', 'يوم') : T('mois', 'شهر')}`
            : T('Non rémunéré', 'غير مدفوع')}
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="p-4 mt-auto space-y-2">
        {/* Ligne principale */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onDetails} className="btn-act-view !px-3 !py-2 !text-xs">
            <Eye size={14} />{T('Voir', 'عرض')}
          </button>
          {onPermissions && (
            <button onClick={onPermissions} className="btn-saas-primary !px-3 !py-2 !text-xs">
              <Shield size={14} />{T('Permissions', 'الصلاحيات')}
            </button>
          )}
        </div>

        {/* Ligne financière */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={onAdvance} className="btn-act-warning !px-2 !py-2 !text-[11px]" title={T('Acompte', 'سلفة')}>
            <CreditCard size={13} />{T('Acompte', 'سلفة')}
          </button>
          <button onClick={onAbsence} className="btn-act-neutral !px-2 !py-2 !text-[11px]" title={T('Absence', 'غياب')}>
            <CalendarX size={13} />{T('Absence', 'غياب')}
          </button>
          <button onClick={onPayment} className="btn-act-payment !px-2 !py-2 !text-[11px]" title={T('Paiement', 'الدفع')}>
            <Wallet size={13} />{T('Payer', 'دفع')}
          </button>
        </div>

        {/* Ligne utilitaire */}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onHistory} className="btn-icon btn-icon-view" title={T('Historique', 'السجل')}>
            <History size={15} />
          </button>
          <button onClick={onEdit} className="btn-icon btn-icon-edit" title={T('Modifier', 'تعديل')}>
            <Pencil size={15} />
          </button>
          <button onClick={onDelete} className="btn-icon btn-icon-delete" title={T('Supprimer', 'حذف')}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </motion.article>
  );
};
