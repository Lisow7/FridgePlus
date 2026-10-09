import { useCallback, createElement } from 'react'
import { useToast } from '@shared/ui/toast/toast-provider'
import { useLang } from '@shared/contexts/ui-provider'
import SaveErrorToast from '@shared/ui/toast/save-error-toast'

// « Pas enregistré » — le message d'une écriture que la base a refusée.
//
// Jusqu'au 2026-10-04 ces refus ne disaient rien : l'écran gardait la nouvelle
// valeur, rien n'était enregistré, et elle disparaissait au rechargement (audit
// UX-02, CPT-11). La règle est maintenant la même partout : l'appelant ANNULE
// ce qu'il avait affiché, puis appelle ce crochet pour le dire.
//
//   const signaler = useSaveErrorToast()
//   signaler('fridge')   // un sujet de SAVE_ERROR_MESSAGES, ou rien
//
// Un seul message à la fois (même identifiant) : dix écritures refusées
// d'affilée — un lot d'ingrédients sans réseau — ne font pas dix messages.
export const SAVE_ERROR_MESSAGES = {
  fr: {
    fridge: 'Pas enregistré : ton frigo n\'a pas pu être mis à jour. Réessaie.',
    favorite: 'Pas enregistré : ce favori n\'a pas pu être gardé. Réessaie.',
    setting: 'Pas enregistré : ce réglage n\'a pas pu être gardé. Réessaie.',
    cooking: 'Pas noté : ce plat n\'a pas pu être ajouté à ton journal de cuisine. Réessaie.',
    rating: 'Pas enregistré : ta note n\'a pas pu être gardée. Réessaie.',
    removal: 'Pas supprimé : la suppression n\'a pas pu se faire. Réessaie.',
    reaction: 'Pas enregistré : ta réaction n\'a pas pu être gardée. Réessaie.',
    generic: 'Pas enregistré. Réessaie.',
  },
  en: {
    fridge: 'Not saved: your fridge could not be updated. Try again.',
    favorite: 'Not saved: this favourite could not be kept. Try again.',
    setting: 'Not saved: this setting could not be kept. Try again.',
    cooking: 'Not logged: this dish could not be added to your cooking journal. Try again.',
    rating: 'Not saved: your rating could not be kept. Try again.',
    removal: 'Not deleted: the deletion could not be done. Try again.',
    reaction: 'Not saved: your reaction could not be kept. Try again.',
    generic: 'Not saved. Try again.',
  },
}

export function useSaveErrorToast() {
  const { show } = useToast()
  const { lang } = useLang()
  return useCallback((subject) => {
    const messages = SAVE_ERROR_MESSAGES[lang] ?? SAVE_ERROR_MESSAGES.fr
    show(
      createElement(SaveErrorToast, { message: messages[subject] ?? messages.generic }),
      { id: 'save-error', role: 'alert', duration: 6000 },
    )
  }, [show, lang])
}
