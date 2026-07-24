import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Loader2, X, ZoomIn, ImageOff } from 'lucide-react';
import type { Language } from '../../types';

/**
 * Zones de dépôt des photos d'inspection — COMPOSANT PARTAGÉ.
 *
 * Une vignette par angle de prise de vue, plutôt qu'un bouton « ajouter » vague :
 * l'agent voit d'un coup d'œil ce qu'il reste à photographier. La même grille
 * sert en lecture seule pour afficher les photos de départ à la clôture.
 */

export interface PhotoSlot {
  /** Identifiant du cadrage : 'exterior-front', 'interior'… */
  id: string;
  label: { fr: string; ar: string };
  icon: string;
  /** Type stocké en base ('exterior' | 'interior' | 'other'). */
  type: string;
  required?: boolean;
}

/** Cadrages proposés par défaut pour une inspection véhicule. */
export const DEFAULT_PHOTO_SLOTS: PhotoSlot[] = [
  { id: 'exterior-front', label: { fr: 'Avant',     ar: 'الأمام' },   icon: '🚗', type: 'exterior', required: true },
  { id: 'exterior-rear',  label: { fr: 'Arrière',   ar: 'الخلف' },    icon: '🚙', type: 'exterior', required: true },
  { id: 'exterior-left',  label: { fr: 'Côté gauche', ar: 'الجانب الأيسر' }, icon: '⬅️', type: 'exterior' },
  { id: 'exterior-right', label: { fr: 'Côté droit',  ar: 'الجانب الأيمن' }, icon: '➡️', type: 'exterior' },
  { id: 'interior',       label: { fr: 'Intérieur',  ar: 'الداخل' },  icon: '🪑', type: 'interior', required: true },
  { id: 'dashboard',      label: { fr: 'Tableau de bord', ar: 'لوحة القيادة' }, icon: '🎛️', type: 'interior' },
  { id: 'trunk',          label: { fr: 'Coffre',     ar: 'الصندوق' }, icon: '🧳', type: 'interior' },
  { id: 'other',          label: { fr: 'Autre',      ar: 'أخرى' },    icon: '📷', type: 'other' },
];

export interface InspectionPhoto {
  url: string;
  type: string;
  slotId?: string;
  file?: File;
}

interface Props {
  lang: Language;
  photos: InspectionPhoto[];
  slots?: PhotoSlot[];
  readOnly?: boolean;
  uploadingSlot?: string | null;
  onUpload?: (file: File, slot: PhotoSlot) => void;
  onRemove?: (photo: InspectionPhoto, index: number) => void;
  title?: string;
}

export const InspectionPhotos: React.FC<Props> = ({
  lang, photos, slots = DEFAULT_PHOTO_SLOTS, readOnly = false,
  uploadingSlot = null, onUpload, onRemove, title,
}) => {
  const isFr = lang === 'fr';
  const T = (fr: string, ar: string) => (isFr ? fr : ar);
  const [preview, setPreview] = useState<string | null>(null);

  /** Photo associée à un cadrage donné. */
  const photoFor = (slot: PhotoSlot) => {
    const bySlot = photos.find(p => p.slotId === slot.id);
    if (bySlot) return bySlot;
    // Photos enregistrées avant l'introduction des cadrages : on retombe sur
    // le premier cliché du même type encore non attribué.
    const used = new Set(photos.filter(p => p.slotId).map(p => p.slotId));
    return photos.find(p => !p.slotId && p.type === slot.type && !used.has(slot.id));
  };

  const filled = slots.filter(s => photoFor(s)).length;
  // Photos qui n'entrent dans aucun cadrage (imports historiques).
  const extras = photos.filter(p => !slots.some(s => photoFor(s) === p));

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="font-black text-sm uppercase tracking-tight flex items-center gap-2"
            style={{ color: 'var(--color-text)' }}>
          <span className="p-1.5 rounded-lg" style={{ background: 'var(--color-gold-soft)', color: 'var(--color-gold)' }}>
            <Camera size={16} />
          </span>
          {title ?? T("Photos d'état du véhicule", 'صور حالة المركبة')}
        </h4>

        <span
          className="text-[11px] font-black px-2.5 py-1 rounded-full"
          style={{
            background: filled > 0 ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
            color: filled > 0 ? 'var(--color-gold)' : 'var(--color-text-muted)',
          }}
        >
          {filled}/{slots.length} {T('photos', 'صور')}
        </span>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {slots.map((slot, i) => {
          const photo = photoFor(slot);
          const isUploading = uploadingSlot === slot.id;

          // ── Emplacement rempli ──
          if (photo) {
            return (
              <motion.div
                key={slot.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                className="relative aspect-[4/3] rounded-xl overflow-hidden group"
                style={{ border: '1.5px solid var(--color-vel-border-gold)' }}
              >
                <img
                  src={photo.url}
                  alt={slot.label[lang]}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />

                {/* Bandeau du cadrage */}
                <span
                  className="absolute inset-x-0 bottom-0 px-2 py-1.5 text-[10px] font-bold truncate"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', color: '#fff' }}
                >
                  {slot.icon} {slot.label[lang]}
                </span>

                {/* Actions au survol */}
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setPreview(photo.url)}
                    className="p-1.5 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}
                    title={T('Agrandir', 'تكبير')}
                  >
                    <ZoomIn size={14} />
                  </button>
                  {!readOnly && onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(photo, photos.indexOf(photo))}
                      className="p-1.5 rounded-lg"
                      style={{ background: 'var(--color-act-delete)', color: '#fff' }}
                      title={T('Supprimer', 'حذف')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          }

          // ── Emplacement vide, lecture seule ──
          if (readOnly) {
            return (
              <div
                key={slot.id}
                className="aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-1.5"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1.5px dashed var(--color-border-soft)',
                  color: 'var(--color-text-dim)',
                }}
              >
                <ImageOff size={20} />
                <span className="text-[10px] font-bold text-center px-1">{slot.label[lang]}</span>
              </div>
            );
          }

          // ── Emplacement vide, éditable ──
          return (
            <motion.label
              key={slot.id}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              whileHover={{ y: -3 }}
              className="aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group"
              style={{
                background: 'var(--color-surface)',
                border: `1.5px dashed ${slot.required ? 'var(--color-vel-border-gold)' : 'var(--color-border)'}`,
                color: 'var(--color-text-muted)',
              }}
            >
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors"
                style={{ background: 'var(--color-surface-2)' }}
              >
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-gold)' }} />
                ) : (
                  slot.icon
                )}
              </span>

              <span className="text-[11px] font-bold text-center px-1 leading-tight">
                {slot.label[lang]}
              </span>

              {slot.required && (
                <span className="text-[9px] font-black uppercase tracking-wide" style={{ color: 'var(--color-gold)' }}>
                  {T('Recommandé', 'موصى به')}
                </span>
              )}

              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={isUploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file && onUpload) onUpload(file, slot);
                  e.target.value = '';
                }}
              />
            </motion.label>
          );
        })}
      </div>

      {/* Photos supplémentaires hors cadrage */}
      {extras.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
             style={{ color: 'var(--color-text-muted)' }}>
            {T('Autres photos', 'صور أخرى')} ({extras.length})
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
            {extras.map((photo, i) => (
              <div
                key={`${photo.url}-${i}`}
                className="relative aspect-square rounded-lg overflow-hidden group"
                style={{ border: '1px solid var(--color-border-soft)' }}
              >
                <img src={photo.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button
                  type="button"
                  onClick={() => setPreview(photo.url)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                >
                  <ZoomIn size={16} />
                </button>
                {!readOnly && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(photo, photos.indexOf(photo))}
                    className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--color-act-delete)', color: '#fff' }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visionneuse plein écran */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 cursor-zoom-out"
            style={{ background: 'rgba(0,0,0,0.9)' }}
          >
            <motion.img
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              src={preview}
              alt=""
              className="max-w-full max-h-full object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => setPreview(null)}
              className="absolute top-5 right-5 p-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
              aria-label={T('Fermer', 'إغلاق')}
            >
              <X size={22} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default InspectionPhotos;
