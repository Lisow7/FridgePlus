import { useCallback } from 'react'
import { useUndo } from '@shared/contexts/undo-provider'

// Vider le frigo, avec 10 secondes pour annuler. Le frigo disparaît de l'écran
// tout de suite (`onEmptyOptimistic`), puis un toast « Annuler » : sans geste,
// la suppression part en base (`onEmptyConfirm`) ; sinon tout revient
// (`onEmptyUndo`). Les deux portes passent par ici — le bouton orange et le
// « Vider » du panneau des recettes, qui supprimait tout d'un coup (audit du
// 2026-10-04, UX-06).
const LIBELLE = { fr: 'Frigo vidé', en: 'Fridge emptied' }

export function useViderLeFrigo({ stock, lang = 'fr', onEmptyOptimistic, onEmptyConfirm, onEmptyUndo }) {
  const { trigger } = useUndo()
  const libelle = LIBELLE[lang] ?? LIBELLE.fr
  return useCallback(() => {
    if (!stock?.size) return
    const misDeCote = new Set(stock)
    onEmptyOptimistic?.()
    trigger({ label: libelle, onConfirm: () => onEmptyConfirm?.(misDeCote), onUndo: () => onEmptyUndo?.(misDeCote) })
  }, [stock, libelle, onEmptyOptimistic, onEmptyConfirm, onEmptyUndo, trigger])
}
