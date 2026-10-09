import { createPortal } from 'react-dom'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'

// Phase 8 launch (refonte Modales) PR 8.8.a. Extraction de
// RecipeFormModal : mini-dialog de confirmation à la fermeture quand des
// modifications non sauvées sont en cours.
//
// `createPortal` vers `document.body` pour échapper au containing block CSS
// créé par le `backdropFilter:'blur(3px)'` du backdrop parent (sinon le
// `position:fixed` est piégé et la modale apparaît dans la largeur du parent
// au lieu du viewport, surtout visible en mobile). Même fix que v3.15.5 sur
// les modales communauté.

export default function RecipeFormCancelDialog({
  isOpen,
  onCancel,    // « Continuer l'édition »
  onConfirm,   // « Quitter sans sauver »
  darkMode,
  t,           // i18n object (confirmCancelTitle, confirmCancelBody, confirmCancelBack, confirmCancelOk)
}) {
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  // Échap = « Continuer l'édition », le choix qui ne perd rien.
  const dialogue = useDialogue({ onClose: onCancel, actif: isOpen })
  if (!isOpen) return null
  const dm = darkMode
  return createPortal(
    <div className="fixed inset-0 z-[70]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,10,4,0.50)', backdropFilter: 'blur(4px)' }}>
      <div {...dialogue.proprietes} style={{
        background: dm ? '#131E2C' : '#FDFAF6',
        borderRadius: '16px', padding: '28px 32px',
        maxWidth: '360px', width: '90%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)', textAlign: 'center',
      }}>
        <p id={dialogue.titreId} style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-charcoal)', margin: '0 0 10px 0' }}>
          {t.confirmCancelTitle}
        </p>
        <p style={{ fontSize: '14px', color: 'var(--color-muted)', margin: '0 0 24px 0' }}>
          {t.confirmCancelBody}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="h-auto rounded-lg border-[1.5px] px-[22px] py-2.5 text-sm font-semibold"
            style={{
              borderColor: dm ? 'var(--color-dark-surface)' : '#E8E0D4',
              color: 'var(--color-charcoal)',
            }}
          >
            {t.confirmCancelBack}
          </Button>
          <Button
            onClick={onConfirm}
            className="h-auto rounded-lg bg-[#D07070] px-[22px] py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            {t.confirmCancelOk}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
