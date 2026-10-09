import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@shared/lib/supabase/client'
import { readAuthLinkParams, authLinkProblem, cleanAuthLinkUrl } from '@shared/lib/auth/auth-link-outcome'

// Retour d'un lien e-mail (ou de Google) qui n'aboutit pas.
//
// La bibliothèque d'authentification traite l'adresse sans rien nous dire
// quand ça échoue : lien expiré, déjà utilisé, ou ouvert dans un autre
// navigateur que celui de la demande. On relève donc ce que l'adresse disait à
// l'arrivée, on attend qu'elle ait fini, et on regarde s'il y a une session.
// Détail des cas : shared/lib/auth/auth-link-outcome.js.
//
// Rend `[probleme, effacer]` — 'expired' | 'failed' | 'no-session' | null.
// Utilisé une seule fois, par `AuthProvider`, qui l'expose à l'application.
export function useAuthLinkProblem() {
  const [atArrival] = useState(() => readAuthLinkParams(window.location.href))
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    if (!atArrival.hasCode && !atArrival.hasError) return
    let cancelled = false
    ;(async () => {
      // `initialize()` rend la promesse du traitement déjà lancé à la création
      // du client : on attend sa fin, on ne le relance pas.
      try { await supabase.auth.initialize?.() } catch { /* on lit la session quand même */ }
      let session = null
      try { session = (await supabase.auth.getSession())?.data?.session ?? null } catch { /* pas de session */ }
      if (cancelled) return
      setProblem(authLinkProblem(atArrival, !!session))
      // Un rechargement ne doit pas rejouer le message (ni garder un code mort).
      window.history.replaceState(window.history.state, '', cleanAuthLinkUrl(window.location.href))
    })()
    return () => { cancelled = true }
  }, [atArrival])

  const clear = useCallback(() => setProblem(null), [])
  return [problem, clear]
}
