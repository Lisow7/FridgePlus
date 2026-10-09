import { useState, useCallback } from 'react'

// Hook orchestrant l'état des portes du frigo et du garde-manger.
// Sprint 10 S10.a.4 — extrait depuis App.jsx.
//
// Pattern : 2 booleans pour savoir si quelque chose est ouvert (utilisé
// pour masquer la tagline / animer le footer), 3 compteurs "signaux"
// que les sous-composants observent pour déclencher leur fermeture
// (chaque incrément = ordre de fermer/ouvrir).
//
// Renvoie :
//   - anyDoorOpen        : boolean — au moins une porte frigo est ouverte
//   - anyPantryOpen      : boolean — au moins un compartiment garde-manger ouvert
//   - doorCloseSignal    : compteur — incrémenté pour ordonner close
//   - doorOpenSignal     : compteur — incrémenté pour ordonner open (rarement utilisé)
//   - pantryCloseSignal  : compteur — idem côté pantry
//   - setAnyDoorOpen     : setter passé en `onDoorChange` aux composants Fridge
//   - setAnyPantryOpen   : setter passé en `onOpenChange` au PantryShelf
//   - closeAllDoors      : action — ferme toutes les portes (frigo + pantry)

export function useFridgeDoors() {
  const [anyDoorOpen,   setAnyDoorOpen]    = useState(false)
  const [anyPantryOpen, setAnyPantryOpen]  = useState(false)
  const [doorCloseSignal,   setDoorCloseSignal]   = useState(0)
  const [doorOpenSignal,    setDoorOpenSignal]    = useState(0)
  const [pantryCloseSignal, setPantryCloseSignal] = useState(0)

  const closeAllDoors = useCallback(() => {
    setDoorCloseSignal(s => s + 1)
    setPantryCloseSignal(s => s + 1)
  }, [])

  const openAllDoors = useCallback(() => {
    setDoorOpenSignal(s => s + 1)
  }, [])

  // Ferme uniquement le garde-manger (sans toucher aux portes du frigo).
  const closePantry = useCallback(() => {
    setPantryCloseSignal(s => s + 1)
  }, [])

  return {
    anyDoorOpen, anyPantryOpen,
    doorCloseSignal, doorOpenSignal, pantryCloseSignal,
    setAnyDoorOpen, setAnyPantryOpen,
    closeAllDoors, openAllDoors, closePantry,
  }
}
