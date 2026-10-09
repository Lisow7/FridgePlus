import { useState, useRef, useCallback } from 'react'

// Garde anti-double-soumission pour les boutons critiques
// (création de recette, ouverture de ticket, inscription, publication
// d'un post communauté, dépôt d'un avis…).
//
// Pourquoi pas un debounce classique ? Un debounce diffère l'action ;
// nous on veut qu'elle parte tout de suite mais qu'un 2e clic pendant
// l'aller-retour réseau soit ignoré.
//
// Usage :
//   const { submitting, guard } = useSubmitGuard()
//   const onClick = guard(async () => { await submitRecipe(...) })
//   <button onClick={onClick} disabled={submitting}>…</button>
//
// `submitting` est un boolean qu'on peut binder à `disabled` + un libellé
// du genre « Envoi… ». Pas de gestion d'erreur magique : si la fn lance,
// l'erreur remonte normalement (à toi de la gérer côté caller).
export function useSubmitGuard() {
  const [submitting, setSubmitting] = useState(false)
  // Ref miroir pour court-circuiter avant le re-render (évite la fenêtre
  // de race entre setSubmitting(true) et le prochain commit React).
  const lockRef = useRef(false)

  const guard = useCallback((asyncFn) => async (...args) => {
    if (lockRef.current) return  // 2e clic ignoré
    lockRef.current = true
    setSubmitting(true)
    try {
      return await asyncFn(...args)
    } finally {
      lockRef.current = false
      setSubmitting(false)
    }
  }, [])

  return { submitting, guard }
}
