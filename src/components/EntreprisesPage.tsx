import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Plus, Search, Pencil, Trash2, History, X, Loader2,
  FileText, Landmark, Hash, Receipt, Phone, Mail, MapPin, AlertTriangle,
} from 'lucide-react';
import type { Entreprise, EntrepriseStats, Language } from '../types';
import { EntrepriseService } from '../services/entrepriseService';
import { usePermissions } from '../utils/usePermissions';

interface Props {
  lang: Language;
}

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} DA`;
const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};

/** Champs légaux d'une entreprise, avec leur icône et un exemple de format. */
const LEGAL_FIELDS = [
  { key: 'rc'  as const, icon: <FileText size={13} />, label: { fr: 'RC',  ar: 'السجل التجاري' }, placeholder: '12/00-0000000B19' },
  { key: 'art' as const, icon: <Landmark size={13} />, label: { fr: 'ART', ar: 'المادة' },        placeholder: '000000000' },
  { key: 'nis' as const, icon: <Hash size={13} />,     label: { fr: 'NIS', ar: 'رقم الإحصاء' },   placeholder: '000000000000000' },
  { key: 'nif' as const, icon: <Receipt size={13} />,  label: { fr: 'NIF', ar: 'الرقم الجبائي' }, placeholder: '000000000000000' },
];

export const EntreprisesPage: React.FC<Props> = ({ lang }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  // Un employé ne voit que les boutons que l'admin lui a accordés.
  const { can } = usePermissions('entreprises');

  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entreprise | null>(null);
  const [historyFor, setHistoryFor] = useState<Entreprise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entreprise | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setEntreprises(await EntrepriseService.getAll());
    } catch (err) {
      console.error('[Entreprises] chargement impossible:', err);
      setEntreprises([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entreprises;
    return entreprises.filter(e =>
      [e.name, e.rc, e.nif, e.nis, e.art, e.phone]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [entreprises, query]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await EntrepriseService.remove(deleteTarget.id);
      setEntreprises(prev => prev.filter(e => e.id !== deleteTarget.id));
    } catch (err) {
      console.error('[Entreprises] suppression impossible:', err);
      alert(T("L'entreprise n'a pas pu être supprimée.", 'تعذر حذف الشركة.'));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-7">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6 rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-2))',
          border: '1px solid var(--color-vel-border-gold)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--color-gold-light), var(--color-gold))',
              boxShadow: 'var(--shadow-gold)',
            }}
          >
            🏛️
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--color-text)' }}>
              {T('Entreprises', 'الشركات')}
            </h1>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {entreprises.length} {T('entreprise(s) enregistrée(s)', 'شركة مسجلة')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={T('Rechercher (nom, RC, NIF…)', 'بحث (الاسم، السجل، الرقم الجبائي…)')}
              className="input-saas ps-9 sm:w-72"
            />
          </div>

          {can('create') && (
            <button
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="btn-saas-primary whitespace-nowrap"
            >
              <Plus size={18} />
              {T('Nouvelle entreprise', 'شركة جديدة')}
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Contenu ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-3xl p-16 text-center"
          style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
        >
          <div className="text-6xl mb-4 opacity-25">🏛️</div>
          <p className="font-bold text-lg" style={{ color: 'var(--color-text-soft)' }}>
            {query
              ? T('Aucune entreprise ne correspond à cette recherche.', 'لا توجد شركة تطابق البحث.')
              : T('Aucune entreprise enregistrée.', 'لا توجد شركات مسجلة.')}
          </p>
          {!query && (
            <button
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="btn-saas-primary mt-6 mx-auto"
            >
              <Plus size={18} />
              {T('Créer la première', 'إنشاء الأولى')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((e, i) => (
            <motion.article
              key={e.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="card-gold p-5 flex flex-col gap-4"
            >
              {/* Identité */}
              <header className="flex items-start gap-3">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg shrink-0"
                  style={{
                    background: 'var(--color-gold-soft)',
                    color: 'var(--color-gold)',
                    border: '1px solid var(--color-vel-border-gold)',
                  }}
                >
                  {e.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h3
                    className="font-black text-base leading-tight truncate"
                    style={{ color: 'var(--color-text)' }}
                    title={e.name}
                  >
                    {e.name}
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                    {T('Créée le', 'أُنشئت في')} {fmtDate(e.createdAt)}
                  </p>
                </div>
              </header>

              {/* Mentions légales */}
              <div className="grid grid-cols-2 gap-2">
                {LEGAL_FIELDS.map(f => (
                  <div
                    key={f.key}
                    className="px-2.5 py-2 rounded-lg min-w-0"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }}
                  >
                    <p
                      className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1"
                      style={{ color: 'var(--color-text-dim)' }}
                    >
                      {f.icon} {f.label[lang]}
                    </p>
                    <p
                      className="text-[11px] font-mono font-bold truncate mt-0.5"
                      style={{ color: e[f.key] ? 'var(--color-text)' : 'var(--color-text-dim)' }}
                      title={e[f.key] || '—'}
                    >
                      {e[f.key] || '—'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Coordonnées */}
              {(e.phone || e.email || e.address) && (
                <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {e.phone && <p className="flex items-center gap-1.5 truncate"><Phone size={12} />{e.phone}</p>}
                  {e.email && <p className="flex items-center gap-1.5 truncate"><Mail size={12} />{e.email}</p>}
                  {e.address && <p className="flex items-center gap-1.5 truncate"><MapPin size={12} />{e.address}</p>}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-1">
                {can('view_history') && (
                  <button
                    onClick={() => setHistoryFor(e)}
                    className="btn-act-view flex-1 !px-3 !py-2 !text-xs"
                    title={T('Historique des locations', 'سجل الإيجارات')}
                  >
                    <History size={14} />
                    {T('Historique', 'السجل')}
                  </button>
                )}
                {can('edit') && (
                  <button
                    onClick={() => { setEditing(e); setFormOpen(true); }}
                    className="btn-icon btn-icon-edit"
                    title={T('Modifier', 'تعديل')}
                  >
                    <Pencil size={15} />
                  </button>
                )}
                {can('delete') && (
                  <button
                    onClick={() => setDeleteTarget(e)}
                    className="btn-icon btn-icon-delete"
                    title={T('Supprimer', 'حذف')}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {/* ── Modales ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {formOpen && (
          <EntrepriseFormModal
            lang={lang}
            entreprise={editing}
            onClose={() => { setFormOpen(false); setEditing(null); }}
            onSaved={saved => {
              setEntreprises(prev => {
                const exists = prev.some(p => p.id === saved.id);
                return exists
                  ? prev.map(p => (p.id === saved.id ? saved : p))
                  : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
              });
              setFormOpen(false);
              setEditing(null);
            }}
          />
        )}

        {historyFor && (
          <EntrepriseHistoryModal
            lang={lang}
            entreprise={historyFor}
            onClose={() => setHistoryFor(null)}
          />
        )}

        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start gap-3">
                <span className="p-2.5 rounded-xl shrink-0"
                      style={{ background: 'rgba(239,68,68,0.14)', color: 'var(--color-act-delete)' }}>
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <h3 className="font-black text-lg" style={{ color: 'var(--color-text)' }}>
                    {T("Supprimer l'entreprise ?", 'حذف الشركة؟')}
                  </h3>
                  <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    {T(
                      `« ${deleteTarget.name} » sera supprimée. Les réservations qui la référencent seront conservées, mais ne seront plus rattachées à une entreprise.`,
                      `سيتم حذف « ${deleteTarget.name} ». ستبقى الحجوزات المرتبطة بها لكن دون شركة.`
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setDeleteTarget(null)} className="btn-saas-outline flex-1">
                  {T('Annuler', 'إلغاء')}
                </button>
                <button onClick={handleDelete} className="btn-saas-danger flex-1">
                  <Trash2 size={16} />
                  {T('Supprimer', 'حذف')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Formulaire de création / modification
// ════════════════════════════════════════════════════════════════════════════

export const EntrepriseFormModal: React.FC<{
  lang: Language;
  entreprise: Entreprise | null;
  onClose: () => void;
  onSaved: (e: Entreprise) => void;
  /** Nom pré-rempli (création depuis la fenêtre d'impression). */
  initialName?: string;
}> = ({ lang, entreprise, onClose, onSaved, initialName }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const [form, setForm] = useState<Partial<Entreprise>>(
    entreprise ?? { name: initialName ?? '', rc: '', art: '', nis: '', nif: '', phone: '', email: '', address: '' }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Entreprise, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name?.trim()) {
      setError(T("Le nom de l'entreprise est obligatoire.", 'اسم الشركة إلزامي.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = entreprise
        ? await EntrepriseService.update(entreprise.id, form)
        : await EntrepriseService.create(form);
      onSaved(saved);
    } catch (err: any) {
      console.error('[Entreprises] enregistrement impossible:', err);
      setError(err?.message || T("L'enregistrement a échoué.", 'فشل الحفظ.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lift)' }}
      >
        <header
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))', color: '#0A0A0B' }}
        >
          <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Building2 size={22} />
            {entreprise ? T("Modifier l'entreprise", 'تعديل الشركة') : T('Nouvelle entreprise', 'شركة جديدة')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/10 cursor-pointer">
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          <div>
            <label className="label-saas">🏢 {T("Nom de l'entreprise", 'اسم الشركة')} *</label>
            <input
              value={form.name ?? ''}
              onChange={e => set('name', e.target.value)}
              className="input-saas"
              placeholder={T("Nom de l'entreprise", 'اسم الشركة')}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LEGAL_FIELDS.map(f => (
              <div key={f.key}>
                <label className="label-saas flex items-center gap-1.5">
                  {f.icon} {f.label[lang]}
                </label>
                <input
                  value={form[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                  className="input-saas font-mono"
                  placeholder={`Ex: ${f.placeholder}`}
                />
              </div>
            ))}
          </div>

          <div
            className="pt-4 space-y-4"
            style={{ borderTop: '1px dashed var(--color-border-soft)' }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              {T('Coordonnées (facultatif)', 'معلومات الاتصال (اختياري)')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-saas">📞 {T('Téléphone', 'الهاتف')}</label>
                <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)}
                       className="input-saas" placeholder="0555 00 00 00" />
              </div>
              <div>
                <label className="label-saas">✉️ Email</label>
                <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)}
                       className="input-saas" placeholder="contact@entreprise.dz" />
              </div>
            </div>
            <div>
              <label className="label-saas">📍 {T('Adresse', 'العنوان')}</label>
              <input value={form.address ?? ''} onChange={e => set('address', e.target.value)}
                     className="input-saas" placeholder={T('Adresse complète', 'العنوان الكامل')} />
            </div>
          </div>

          {error && (
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-act-delete)' }}>
              <AlertTriangle size={14} /> {error}
            </p>
          )}
        </div>

        <footer className="p-5 flex gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn-saas-outline flex-1" disabled={saving}>
            {T('Annuler', 'إلغاء')}
          </button>
          <button onClick={save} className="btn-saas-primary flex-1" disabled={saving}>
            {saving
              ? <><Loader2 size={16} className="animate-spin" />{T('Enregistrement…', 'جاري الحفظ…')}</>
              : (entreprise ? T('Enregistrer', 'حفظ') : T('Créer', 'إنشاء'))}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Historique des locations d'une entreprise
// ════════════════════════════════════════════════════════════════════════════

const EntrepriseHistoryModal: React.FC<{
  lang: Language;
  entreprise: Entreprise;
  onClose: () => void;
}> = ({ lang, entreprise, onClose }) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<EntrepriseStats>({
    reservationsCount: 0, total: 0, totalPaid: 0, totalRemaining: 0,
  });

  useEffect(() => {
    EntrepriseService.getHistory(entreprise.id)
      .then(({ reservations, stats }) => { setRows(reservations); setStats(stats); })
      .catch(err => console.error('[Entreprises] historique impossible:', err))
      .finally(() => setLoading(false));
  }, [entreprise.id]);

  const statCard = (label: string, value: string, color: string) => (
    <div
      className="rounded-xl p-4 text-center"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-xl font-black mt-1" style={{ color }}>{value}</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-4xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lift)' }}
      >
        <header
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold))', color: '#0A0A0B' }}
        >
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tighter truncate">{entreprise.name}</h2>
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-70">
              {T('Historique des locations', 'سجل الإيجارات')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/10 cursor-pointer shrink-0">
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Totaux */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCard(T('Locations', 'الإيجارات'), String(stats.reservationsCount), 'var(--color-text)')}
            {statCard(T('Total', 'الإجمالي'), money(stats.total), 'var(--color-gold)')}
            {statCard(T('Total payé', 'المدفوع'), money(stats.totalPaid), 'var(--color-act-success)')}
            {statCard(T('Reste dû', 'المتبقي'), money(stats.totalRemaining),
              stats.totalRemaining > 0 ? 'var(--color-act-warning)' : 'var(--color-text-muted)')}
          </div>

          {/* Liste */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center py-14 text-sm" style={{ color: 'var(--color-text-dim)' }}>
              {T('Aucune location enregistrée pour cette entreprise.', 'لا توجد إيجارات مسجلة لهذه الشركة.')}
            </p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border-soft)' }}>
              {rows.map((r, i) => {
                const paid = (r.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
                  || Number(r.advance_payment) || 0;
                const total = Number(r.total_price) || 0;
                const rest = Math.max(0, total - paid);

                return (
                  <div
                    key={r.id}
                    className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between"
                    style={{
                      borderTop: i === 0 ? undefined : '1px solid var(--color-border-soft)',
                      background: i % 2 ? 'var(--color-surface-2)' : 'transparent',
                    }}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                        {r.car?.brand} {r.car?.model}
                        <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>
                          {' — '}{r.client?.first_name} {r.client?.last_name}
                        </span>
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                        {fmtDate(r.departure_date)} → {fmtDate(r.return_date)}
                        {' · '}{r.total_days} {T('j', 'ي')}
                        {' · '}{r.status}
                      </p>
                    </div>

                    <div className="flex gap-4 text-right shrink-0">
                      <div>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>{T('Total', 'الإجمالي')}</p>
                        <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{money(total)}</p>
                      </div>
                      <div>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>{T('Payé', 'المدفوع')}</p>
                        <p className="font-bold text-sm" style={{ color: 'var(--color-act-success)' }}>{money(paid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>{T('Reste', 'المتبقي')}</p>
                        <p className="font-bold text-sm"
                           style={{ color: rest > 0 ? 'var(--color-act-warning)' : 'var(--color-text-muted)' }}>
                          {money(rest)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EntreprisesPage;
