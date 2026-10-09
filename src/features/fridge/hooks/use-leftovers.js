import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getLeftovers,
  addLeftover as apiAddLeftover,
  deleteLeftover as apiDeleteLeftover,
  isLeftoverExpired,
  countSavedLeftovers,
} from '@features/fridge/api/leftovers'
import { logError } from '@shared/lib/observability/sentry'

// Sprint 6 PR S6.g — Custom hook `useLeftovers`.
//
// Encapsule le state `leftovers` (array d'objets {id, name, emoji,
// ingredient_id, expires_at, etc.}) avec son load auto au mount/changement
// user et les opérations d'ajout/suppression.
//
// Spécificité vs useFridgeStock/useFavorites : les leftovers sont
// user-only (pas de fallback localStorage car notion de DLC user-perso
// n'a pas de sens en mode guest). Donc l'état est `[]` si pas de user.
//
// API exposée :
//   const { leftovers, setLeftovers, expiredLeftoversCount,
//           addLeftover, deleteLeftover } = useLeftovers(user)
//
//   - `setLeftovers` exposé pour orchestration externe (logout reset).
//   - `expiredLeftoversCount` : memo dérivé pour le badge UI.

export function useLeftovers(user) {
  const [leftovers, setLeftovers] = useState([])
  // Compteur « restes sauvés » (supprimés avant leur DLC) — indicateur anti-gaspi
  // côté restes. Rechargé au mount/user et après chaque suppression.
  const [savedCount, setSavedCount] = useState(0)

  const reloadSaved = useCallback(() => {
    if (!user?.id) { setSavedCount(0); return }
    countSavedLeftovers(user.id)
      .then(setSavedCount)
      .catch(err => logError(err, { tag: 'useLeftovers.savedCount', userId: user.id }))
  }, [user?.id])

  // Load au mount + sur changement user.id. Cancel flag pour ignorer
  // une réponse en retard si user change rapidement.
  useEffect(() => {
    if (!user?.id) {
      setLeftovers([])
      setSavedCount(0)
      return
    }
    let cancelled = false
    getLeftovers(user.id)
      .then(data => { if (!cancelled) setLeftovers(data) })
      .catch(err => {
        if (cancelled) return
        logError(err, { tag: 'useLeftovers.load', userId: user.id })
      })
    reloadSaved()
    return () => { cancelled = true }
  }, [user?.id, reloadSaved])

  const addLeftover = useCallback(async (payload) => {
    if (!user?.id) return { error: { message: 'no_user' } }
    const { data, error } = await apiAddLeftover(user.id, payload)
    if (data) setLeftovers(prev => [data, ...prev])
    return { data, error }
  }, [user?.id])

  const deleteLeftover = useCallback(async (id) => {
    if (!user?.id || !id) return
    await apiDeleteLeftover(id, user.id)
    setLeftovers(prev => prev.filter(l => l.id !== id))
    reloadSaved() // un reste supprimé avant sa DLC incrémente « restes sauvés »
  }, [user?.id, reloadSaved])

  // Memo : nombre de leftovers expirés (DLC dépassée). Utilisé pour le
  // badge UI sur le bouton « Restes » et l'icône frigo (clignotement
  // alerte si > 0). Recalculé seulement quand `leftovers` change.
  const expiredLeftoversCount = useMemo(
    () => leftovers.filter(l => isLeftoverExpired(l.expires_at)).length,
    [leftovers]
  )

  return {
    leftovers,
    setLeftovers,
    expiredLeftoversCount,
    savedCount,
    addLeftover,
    deleteLeftover,
  }
}
