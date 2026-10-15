import { useState, useEffect } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import { abonnementDeCetAppareil, cetAppareilEstRattache } from '@shared/lib/push/cet-appareil'
import { subscribeToPush, unsubscribeFromPush } from '../api/push-subscriptions'
import { iosPushBlocked } from './is-ios-standalone'

// Hook partagé entre le récap (ConfidentialityPanel, lecture seule) et la
// catégorie interactive (CookieModal, toggle réel) — une seule source de
// vérité pour l'état d'abonnement push, pas de logique dupliquée.
//
// `enabled` dit l'état de CET appareil : le navigateur tient un abonnement ET il
// est rattaché au compte courant. Pas les préférences du compte : à la
// reconnexion, elles disaient « Activées » sans abonnement, et couper
// l'interrupteur éteignait alors les rappels sur tous les autres appareils du
// compte (CPT-15).
//
// `error` : null, 'permission_denied' (la personne a dit « Bloquer » — un réglage
// du navigateur, pas une panne), 'unsupported', 'failed', 'read_failed', et
// 'dev_sans_sw' sous `npm run dev` seulement.
// `sw_missing` (aucun service worker enregistré) : en développement c'est l'état
// normal (`devOptions.enabled: false`, vite.config.js) et on le dit tel quel — dit
// « pas pris en charge », il accusait le navigateur à tort (vu le 2026-10-15) ; dans
// un navigateur restreint, « pas pris en charge ». `sw_timeout` (il ne s'active pas)
// se dit comme une panne.
const CODES = { permission_denied: 'permission_denied', push_unsupported: 'unsupported', sw_missing: 'unsupported' }
function codeDErreur(erreur) {
  if (erreur.message === 'sw_missing' && import.meta.env.DEV) return 'dev_sans_sw'
  return CODES[erreur.message] ?? 'failed'
}

export function usePushSubscription() {
  const pushEnabled = useFeatureFlag('push_notifications', false)
  const { user } = useAuth()
  // L'état lu pour un compte ne vaut que pour lui : dérivé, il n'a rien à remettre
  // à zéro quand le compte change (et rien à poser en synchrone dans l'effet).
  const [appareil, setAppareil] = useState({ pour: null, enabled: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const enabled = appareil.pour === user?.id && appareil.enabled

  useEffect(() => {
    const id = user?.id
    if (!id) return
    let perime = false
    ;(async () => {
      try {
        const abonnement = await abonnementDeCetAppareil()
        if (perime) return
        if (!abonnement) { setAppareil({ pour: id, enabled: false }); return }
        const { rattache, error: erreur } = await cetAppareilEstRattache(abonnement.endpoint)
        if (perime) return
        if (erreur) setError('read_failed')
        setAppareil({ pour: id, enabled: !erreur && rattache })
      } catch {
        if (!perime) { setError('read_failed'); setAppareil({ pour: id, enabled: false }) }
      }
    })()
    return () => { perime = true }
  }, [user?.id])

  async function toggle() {
    setLoading(true)
    setError(null)
    try {
      const { error: erreur } = enabled ? await unsubscribeFromPush() : await subscribeToPush()
      if (!erreur) setAppareil({ pour: user?.id, enabled: !enabled })
      else setError(codeDErreur(erreur))
    } finally {
      setLoading(false)
    }
  }

  return {
    available: pushEnabled && Boolean(user),
    enabled,
    loading,
    error,
    blocked: iosPushBlocked(),
    toggle,
  }
}
