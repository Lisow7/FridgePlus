import { useId, useState } from 'react'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'

// Le motif d'un rejet dans la file d'import (audit du 2026-10-04, ADM-17 (5)).
// Avant : `window.prompt()` — hors de la charte, hors du lecteur d'écran, et un
// motif vide devenait « no reason ». Ici : une vraie boîte de dialogue (rôle,
// nom, focus, Échap), et le bouton n'avance pas sans motif.

export default function MotifDeRejetModal({ recipeName, darkMode = false, onConfirm, onCancel }) {
  const [motif, setMotif] = useState('')
  const motifId = useId()
  const dialogue = useDialogue({ onClose: onCancel })
  const pret = motif.trim().length > 0

  const bg     = darkMode ? '#0F1923' : '#FFF'
  const border = darkMode ? '#2A3A50' : '#D9CCBA'
  const text   = darkMode ? '#C8D8E8' : '#1A0F00'

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onCancel}
    >
      <div
        {...dialogue.proprietes}
        onClick={e => e.stopPropagation()}
        style={{ background: bg, color: text, borderRadius: 16, padding: '22px 26px', maxWidth: 480, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.35)', border: `1px solid ${border}` }}
      >
        <h3 id={dialogue.titreId} style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
          Rejeter « {recipeName} » ?
        </h3>
        <label htmlFor={motifId} style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 4 }}>
          Motif du rejet (gardé dans la file)
        </label>
        <textarea
          id={motifId}
          value={motif}
          onChange={e => setMotif(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="ex. : doublon d’une recette déjà publiée"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <Button variant="secondary" onClick={onCancel} className="h-auto rounded-lg border bg-transparent px-4 py-2 text-[13px]" style={{ borderColor: border, color: text }}>
            Annuler
          </Button>
          <Button disabled={!pret} onClick={() => onConfirm(motif.trim())} className="h-auto rounded-lg px-4 py-2 text-[13px] font-bold text-white" style={{ background: 'var(--color-danger)' }}>
            Rejeter la recette
          </Button>
        </div>
      </div>
    </div>
  )
}
