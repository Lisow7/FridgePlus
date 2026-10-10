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
// du navigateur, pas une panne), 'unsupported', 'failed', 'read_failed'.
const CODES = { permission_denied: 'permission_denied', push_unsupported: 'unsupported' }

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
      else setError(CODES[erreur.message] ?? 'failed')
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
