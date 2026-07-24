import React, { useMemo, useState } from 'react';
import { Worker, Language, WorkerPayment } from '../types';
import { motion } from 'motion/react';
import { X, Wallet, CreditCard, CalendarX, Pencil, RotateCcw, Loader2 } from 'lucide-react';

interface WorkerPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: Worker;
  lang: Language;
  onCreatePayment?: (payment: WorkerPayment) => Promise<void>;
}

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} DA`;
const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

/**
 * Calcul du paiement d'un employé.
 *
 * Ne prennent part au calcul que les acomptes et absences NON ENCORE SOLDÉS
 * (`settled !== true`) : une fois déduits d'un paiement, ils disparaissent des
 * en-cours et ne sont donc jamais décomptés deux fois.
 *
 * Le net calculé peut être remplacé à la main, la date est modifiable, et la
 * description reste facultative.
 */
export const WorkerPaymentModal: React.FC<WorkerPaymentModalProps> = ({
  isOpen, onClose, worker, lang, onCreatePayment,
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  // Seuls les mouvements encore dus.
  const pendingAdvances = useMemo(
    () => (worker.advances || []).filter(a => a.settled !== true),
    [worker.advances]
  );
  const pendingAbsences = useMemo(
    () => (worker.absences || []).filter(a => a.settled !== true),
    [worker.absences]
  );

  const totalAdvances = pendingAdvances.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const totalAbsences = pendingAbsences.reduce((s, a) => s + (Number(a.cost) || 0), 0);
  const base = Number(worker.baseSalary) || 0;
  const netSalary = base - totalAdvances - totalAbsences;

  const [manualAmount, setManualAmount] = useState<number | ''>('');
  const [isManual, setIsManual] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const finalAmount = isManual && manualAmount !== '' ? Number(manualAmount) : netSalary;

  const handleCreatePayment = async () => {
    setSaving(true);
    try {
      const newPayment: WorkerPayment = {
        id: Date.now().toString(),
        amount: finalAmount,
        date,
        baseSalary: base,
        advances: totalAdvances,
        absences: totalAbsences,
        netSalary,
        description: description.trim() || undefined,
        // Trace des mouvements soldés par ce paiement : ils sortent des en-cours.
        advanceIds: pendingAdvances.map(a => a.id),
        absenceIds: pendingAbsences.map(a => a.id),
        isManualAmount: isManual,
      };
      await onCreatePayment?.(newPayment);
      onClose();
    } catch (err) {
      console.error('Error creating payment:', err);
    } finally {
      setSaving(false);
    }
  };

  const line = (
    icon: React.ReactNode,
    label: string,
    value: string,
    color: string,
    items?: React.ReactNode
  ) => (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}>
          {icon} {label}
        </span>
        <span className="font-black text-sm" style={{ color }}>{value}</span>
      </div>
      {items}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lift)' }}
      >
        <header
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))', color: '#0A0A0B' }}
        >
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <Wallet size={20} /> {T('Paiement', 'الدفع')}
            </h2>
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-75 truncate mt-0.5">
              {worker.fullName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/10 cursor-pointer shrink-0">
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar" style={{ background: 'var(--color-bg)' }}>
          {/* Base */}
          {line(
            <Wallet size={13} />,
            worker.paymentType === 'daily'
              ? T('Montant journalier', 'المبلغ اليومي')
              : T('Salaire de base', 'الراتب الأساسي'),
            money(base),
            'var(--color-text)'
          )}

          {/* Acomptes non soldés */}
          {line(
            <CreditCard size={13} />,
            T('Acomptes à déduire', 'السلف المستحقة'),
            `− ${money(totalAdvances)}`,
            'var(--color-act-warning)',
            pendingAdvances.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {pendingAdvances.map(a => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      {fmtDate(a.date)}{(a.description || a.note) ? ` — ${a.description || a.note}` : ''}
                    </span>
                    <span className="shrink-0 font-bold">{money(a.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                {T('Aucun acompte en attente.', 'لا توجد سلف معلقة.')}
              </p>
            )
          )}

          {/* Absences non soldées */}
          {line(
            <CalendarX size={13} />,
            T('Absences à déduire', 'الغيابات المستحقة'),
            `− ${money(totalAbsences)}`,
            'var(--color-act-delete)',
            pendingAbsences.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {pendingAbsences.map(a => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      {fmtDate(a.date)}{(a.description || a.note) ? ` — ${a.description || a.note}` : ''}
                    </span>
                    <span className="shrink-0 font-bold">{money(a.cost)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                {T('Aucune absence en attente.', 'لا توجد غيابات معلقة.')}
              </p>
            )
          )}

          {/* Net à payer */}
          <div
            className="rounded-xl p-4"
            style={{
              background: 'var(--color-gold-soft)',
              border: '1px solid var(--color-vel-border-gold)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                {T('Net à payer', 'الصافي المستحق')}
              </span>
              <span className="font-black text-2xl"
                    style={{ color: finalAmount >= 0 ? 'var(--color-gold)' : 'var(--color-act-delete)' }}>
                {money(finalAmount)}
              </span>
            </div>

            {/* Ajustement manuel */}
            {isManual ? (
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  value={manualAmount}
                  onChange={e => setManualAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input-saas flex-1"
                  placeholder={String(netSalary)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setIsManual(false); setManualAmount(''); }}
                  className="btn-icon btn-icon-gold shrink-0"
                  title={T('Revenir au montant calculé', 'العودة للمبلغ المحسوب')}
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setIsManual(true); setManualAmount(netSalary); }}
                className="mt-2 text-[11px] font-bold underline flex items-center gap-1.5 cursor-pointer"
                style={{ color: 'var(--color-gold)' }}
              >
                <Pencil size={11} /> {T('Modifier le montant manuellement', 'تعديل المبلغ يدويًا')}
              </button>
            )}
          </div>

          {/* Date + description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="label-saas">{T('Date du paiement', 'تاريخ الدفع')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-saas" />
            </div>
            <div>
              <label className="label-saas">
                {T('Description', 'الوصف')}
                <span style={{ color: 'var(--color-text-dim)' }}> ({T('facultatif', 'اختياري')})</span>
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input-saas"
                placeholder={T('ex : salaire de juillet', 'مثال: راتب جويلية')}
              />
            </div>
          </div>
        </div>

        <footer className="p-5 flex gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn-saas-outline flex-1" disabled={saving}>
            {T('Annuler', 'إلغاء')}
          </button>
          <button onClick={handleCreatePayment} className="btn-act-payment flex-1" disabled={saving}>
            {saving
              ? <><Loader2 size={16} className="animate-spin" />{T('Enregistrement…', 'جاري الحفظ…')}</>
              : <><Wallet size={16} />{T('Enregistrer le paiement', 'حفظ الدفع')}</>}
          </button>
        </footer>
      </motion.div>
    </div>
  );
};
