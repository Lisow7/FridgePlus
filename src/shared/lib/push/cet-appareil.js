import { supabase } from '@shared/lib/supabase/client'
import { logError } from '@shared/lib/observability/sentry'

// L'abonnement push de CET appareil : celui que tient le navigateur, et la ligne qui le
// rattache à un compte (`push_subscriptions`, une ligne par endpoint, lisible et effaçable
// par son seul propriétaire — RLS `push_subscriptions_select_own` / `_delete_own`).
//
// Pourquoi ici et pas dans la feature push : la déconnexion (contexte d'auth, `src/shared`)
// doit détacher l'appareil AVANT de fermer la session, et `src/shared` ne dépend pas de
// `src/features`. La feature réutilise ces briques pour l'interrupteur.

// L'abonnement que tient le navigateur, ou null (pas de service worker, pas d'abonnement).
export async function abonnementDeCetAppareil() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null
  const registration = await navigator.serviceWorker.ready
  return (await registration.pushManager.getSubscription()) ?? null
}

// Cet abonnement est-il rattaché au compte courant ? La RLS ne rend que ses propres lignes :
// une ligne absente veut dire « pas à moi » (autre compte, ou jamais enregistré).
export async function cetAppareilEstRattache(endpoint) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint')
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (error) return { rattache: false, error }
  return { rattache: Boolean(data), error: null }
}

// Détache cet appareil : sa ligne d'abord (refusée → on s'arrête, le navigateur reste abonné,
// l'état reste cohérent), puis l'abonnement du navigateur. Ne touche PAS aux préférences du
// compte (`profiles.push_preferences`) : les autres appareils gardent leurs rappels.
// Rend `{ detache, error }` ; ne lève jamais.
export async function detacherCetAppareil() {
  try {
    const abonnement = await abonnementDeCetAppareil()
    if (!abonnement) return { detache: false, error: null }
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', abonnement.endpoint)
    if (error) return { detache: false, error }
    await abonnement.unsubscribe()
    return { detache: true, error: null }
  } catch (err) {
    return { detache: false, error: err ?? new Error('unknown') }
  }
}

// « Déconnecter tous mes appareils », suppression du compte : les lignes de TOUS les appareils
// du compte (RLS `push_subscriptions_delete_own`) — un téléphone perdu ne reçoit plus les
// notifications du compte. Au mieux et borné, comme pour cet appareil.
export async function detacherTousLesAppareilsAvantDePartir(userId, { delaiMs = 3000 } = {}) {
  let minuteur
  const tropLong = new Promise((resolve) => {
    minuteur = setTimeout(() => resolve({ detache: false, error: new Error('push_detach_all_timeout') }), delaiMs)
  })
  const effacer = (async () => {
    try {
      const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', userId)
      return { detache: !error, error: error ?? null }
    } catch (err) {
      return { detache: false, error: err ?? new Error('unknown') }
    }
  })()
  const resultat = await Promise.race([effacer, tropLong])
  clearTimeout(minuteur)
  if (resultat.error) logError(resultat.error, { tag: 'push.detach_all_on_signout' })
  return resultat
}

// À la déconnexion : au mieux, et borné — une requête qui pend ne doit jamais retenir la
// fermeture de la session. L'échec s'écrit au journal, la déconnexion continue.
export async function detacherCetAppareilAvantDePartir({ delaiMs = 3000 } = {}) {
  let minuteur
  const tropLong = new Promise((resolve) => {
    minuteur = setTimeout(() => resolve({ detache: false, error: new Error('push_detach_timeout') }), delaiMs)
  })
  const resultat = await Promise.race([detacherCetAppareil(), tropLong])
  clearTimeout(minuteur)
  if (resultat.error) logError(resultat.error, { tag: 'push.detach_on_signout' })
  return resultat
}
