import { useState, useCallback, useEffect, useRef } from 'react'
import { addFavorite, removeFavorite } from '@features/recipes/api/favorites'
import { createWriteSeries } from '@shared/lib/optimistic-writes'

// Sprint 6 PR S6.f — Custom hook `useFavorites`.
//
// Encapsule le state `favorites` (Set d'ids de recettes favoris) avec
// le pattern hybride DB / localStorage. Strictement similaire à
// `useFridgeStock` (v3.233.0) mais sur la table favorites.
//
// API exposée :
//   const { favorites, setFavorites, toggleFavorite } = useFavorites(user)
//
//   - `setFavorites` (raw setter) exposé pour orchestration externe
//     (logout reset, load post-login depuis App.jsx).
//   - `toggleFavorite` : ajoute si absent, retire si présent, sync persistence.
//
// 🔴 Une écriture refusée par la base ANNULE ce qu'elle avait affiché, et le
// dit (`onSaveError`) — même règle que `useFridgeStock`. Jusqu'au 2026-10-04
// le résultat était jeté : le favori restait affiché puis disparaissait au
// rechargement, sans un mot (audit UX-02). L'appel partait aussi DEPUIS
// l'updater de `setFavorites`, que React rejoue en mode strict : deux requêtes
// par clic en développement. Quand deux écritures de la même recette se
// croisent, c'est `shared/lib/optimistic-writes.js` qui dit ce que la base
// contient.

const LOCALSTORAGE_KEY = 'fridge-favorites'

function loadInitialFavorites() {
  try {
    const saved = localStorage.getItem(LOCALSTORAGE_KEY)
    return new Set(saved ? JSON.parse(saved) : [])
  } catch {
    return new Set()
  }
}

function persistLocalStorage(set) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // localStorage indisponible — silent
  }
}

export function useFavorites(user, { onSaveError } = {}) {
  const [favorites, setFavorites] = useState(loadInitialFavorites)

  // Projection de l'état courant, lisible hors des updaters : resynchronisée
  // après chaque rendu, et avancée à la main entre deux rendus pour que deux
  // gestes du même tick se composent.
  const favoritesRef = useRef(favorites)
  const onSaveErrorRef = useRef(onSaveError)
  useEffect(() => { favoritesRef.current = favorites }, [favorites])
  useEffect(() => { onSaveErrorRef.current = onSaveError }, [onSaveError])
  // Le compte affiché : une réponse en retard d'un compte ne doit pas toucher
  // l'écran du suivant.
  const userIdRef = useRef(user?.id)
  useEffect(() => { userIdRef.current = user?.id }, [user?.id])
  // Les écritures en vol, recette par recette.
  const [series] = useState(createWriteSeries)

  const toggleFavorite = useCallback((id) => {
    const removing = favoritesRef.current.has(id)
    const next = new Set(favoritesRef.current)
    if (removing) next.delete(id)
    else next.add(id)
    favoritesRef.current = next
    setFavorites(prev => {
      const suivant = new Set(prev)
      if (removing) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })

    if (!user) { persistLocalStorage(next); return }

    // États : la recette est-elle en favori ? Avant le geste, puis après.
    // Registre tenu PAR COMPTE : l'écriture encore en vol d'un compte qui
    // vient de se déconnecter ne doit pas retenir celles du suivant.
    const emetteur = user.id
    const ecriture = series.ouvrir(`${emetteur}|${id}`, removing, !removing)
    let envoi
    try { envoi = Promise.resolve(removing ? removeFavorite(user.id, id) : addFavorite(user.id, id)) }
    catch (err) { envoi = Promise.reject(err) }
    // Un appel qui lève (réseau coupé) compte comme un refus.
    envoi.then((resultat) => !!resultat?.error, () => true).then((refusee) => {
      const aRemettre = series.fermer(ecriture, refusee)
      // Rien à remettre — ou le compte a changé pendant le vol : cette
      // réponse ne concerne plus l'écran affiché.
      if (!aRemettre || userIdRef.current !== emetteur) return
      setFavorites(prev => {
        const retabli = new Set(prev)
        if (aRemettre.etat) retabli.add(id)
        else retabli.delete(id)
        return retabli
      })
      // Dit seulement si la personne n'a pas ce qu'elle voulait.
      if (aRemettre.etat !== aRemettre.voulu) onSaveErrorRef.current?.()
    })
  }, [user, series])

  return { favorites, setFavorites, toggleFavorite }
}
