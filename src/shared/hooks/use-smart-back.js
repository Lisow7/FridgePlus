import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Hook réutilisable pour fermer une route-as-page proprement.
//
// Sprint 11 S11.c.1 — créé pour `<RecipePage />` (et future utilisation
// par toutes les pages issues d'une migration modal→route).
//
// Problème résolu : `navigate(-1)` est faux quand l'user arrive
// directement sur la page (lien partagé, refresh, nouvel onglet). Dans
// ce cas, l'history est vide et `navigate(-1)` sort de l'app. On
// retombe sur le site précédent du browser (Google, autre onglet…),
// pas sur la home Fridge+.
//
// Solution : si la location courante a une `key` autre que `'default'`
// (= il y a au moins une entrée d'history avant elle), on fait
// `navigate(-1)`. Sinon on `navigate(fallback)` (par défaut `/`).
//
// Usage :
//   const onClose = useSmartBack()           // fallback `/`
//   const onClose = useSmartBack('/profile') // fallback custom
export function useSmartBack(fallback = '/') {
  const location = useLocation()
  const navigate = useNavigate()
  return useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1)
    } else {
      navigate(fallback, { replace: true })
    }
  }, [location.key, navigate, fallback])
}
