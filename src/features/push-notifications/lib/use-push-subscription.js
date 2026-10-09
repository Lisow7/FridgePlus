import { useState, useEffect } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import { getPushPreferences, subscribeToPush, unsubscribeFromPush } from '../api/push-subscriptions'
import { iosPushBlocked } from './is-ios-standalone'

// Hook partagé entre le récap (ConfidentialityPanel, lecture seule) et la
// catégorie interactive (CookieModal, toggle réel) — une seule source de
// vérité pour l'état d'abonnement push, pas de logique dupliquée.
export function usePushSubscription() {
  const pushEnabled = useFeatureFlag('push_notifications', false)
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    getPushPreferences(user.id).then(({ data }) => {
      if (data) setEnabled(Boolean(data.inactivity_reminder))
    })
  }, [user?.id])

  async function toggle() {
    setLoading(true)
    setError(false)
    try {
      if (enabled) {
        const { error } = await unsubscribeFromPush()
        if (!error) setEnabled(false)
        else setError(true)
      } else {
        const { error } = await subscribeToPush()
        if (!error) setEnabled(true)
        else setError(true)
      }
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
