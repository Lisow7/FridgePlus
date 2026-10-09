import { useCallback, useRef } from 'react'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'

// Fermer une fenêtre sans perdre ce qu'on y a tapé (audit du 2026-10-04,
// ADM-18 : un brouillon d'annonce ou un motif de modération se perdait sur un
// clic).
//   - Le fond ne ferme que si le clic y a COMMENCÉ et FINI : un cliquer-glisser
//     commencé dans un champ (sélectionner du texte) et relâché hors de la carte
//     fermait la fenêtre. Un clic venu d'un bouton de la carte, qui remonte
//     jusqu'au fond, ne le ferme pas non plus.
//   - Avec un brouillon, fermer (fond, croix, « Annuler », Échap) demande
//     d'abord.
//
// Usage :
//   const { fermer, fond } = useFermetureGardee({ onClose, brouillon: titre.trim() !== '' })
//   <div {...fond}> <div role="dialog"> … <button onClick={fermer}>Annuler</button> </div> </div>
//   et `useDialogue({ onClose: fermer })` pour Échap.
export function useFermetureGardee({ onClose, brouillon, question = {} }) {
  const confirm = useConfirm()
  const departSurLeFond = useRef(false)

  const fermer = useCallback(async () => {
    if (brouillon && !(await confirm({
      title: question.title ?? 'Abandonner ce brouillon ?',
      body: question.body ?? 'Ce que tu as écrit sera perdu.',
      confirmLabel: question.confirmLabel ?? 'Abandonner',
      cancelLabel: question.cancelLabel ?? 'Continuer',
      danger: true,
    }))) return
    onClose()
  }, [brouillon, confirm, onClose, question.title, question.body, question.confirmLabel, question.cancelLabel])

  const fond = {
    onMouseDown: (e) => { departSurLeFond.current = e.target === e.currentTarget },
    onClick: (e) => {
      const surLeFond = departSurLeFond.current && e.target === e.currentTarget
      departSurLeFond.current = false
      if (surLeFond) fermer()
    },
  }

  return { fermer, fond }
}
