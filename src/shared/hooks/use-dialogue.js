import { useId, useRef } from 'react'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'

// Ce qui fait d'une surcouche une vraie boîte de dialogue, sans toucher à son
// apparence (audit du 2026-10-04, A11Y-01).
//
// Vingt surcouches plein écran avaient été écrites avant la brique commune :
// ni rôle ni nom pour les lecteurs d'écran, la touche Tab partait derrière
// (focus invisible), Échap ne fermait rien, le focus n'était pas rendu à la
// fermeture — dont la confirmation de suppression de compte et le
// signalement. Ce hook leur donne tout cela :
//   - `role="dialog"`, `aria-modal`, et un nom (le titre, par `titreId`) ;
//   - le focus posé dedans à l'ouverture, piégé, rendu au déclencheur ensuite ;
//   - Échap qui ferme.
//
// Usage — sur le PANNEAU (pas le fond cliquable) :
//   const dialogue = useDialogue({ onClose, actif: ouvert })
//   <div {...dialogue.proprietes}> <h3 id={dialogue.titreId}>…</h3> … </div>
// Sans titre visible : `useDialogue({ onClose, nom: 'Libellé' })`.
export function useDialogue({ onClose, actif = true, nom } = {}) {
  const ref = useRef(null)
  const titreId = useId()
  useFocusTrap(ref, { active: actif, onEscape: onClose })
  return {
    titreId,
    proprietes: {
      ref,
      role: 'dialog',
      'aria-modal': 'true',
      ...(nom ? { 'aria-label': nom } : { 'aria-labelledby': titreId }),
    },
  }
}
