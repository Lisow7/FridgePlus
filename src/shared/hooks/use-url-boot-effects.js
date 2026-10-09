import { useEffect, useState } from 'react'

// Hooks pour les "URL boot effects" — lecture de paramètres URL au
// premier rendu, action correspondante, et nettoyage immédiat de l'URL
// (évite boucles sur refresh). Sprint 9 S9.h.1.

function cleanParam(paramName) {
  const params = new URLSearchParams(window.location.search)
  params.delete(paramName)
  const newSearch = params.toString()
  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`
  )
}

// ── Panier partagé public (?shared=<uuid>) ─────────────────────────────
//
// Lazy initializer : lit et nettoie le paramètre URL dès le premier
// render (avant le paint) sans passer par un useEffect.
export function useSharedBasketId() {
  return useState(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('shared')
    if (!id) return null
    cleanParam('shared')
    return id
  })
}

// ── Retour Stripe Checkout (?subscription=activated) + deep link ───────
//
// Aussi gère `?modal=upgrade` (deep link app mobile).
//
// Usage :
//   const subscriptionToast = useSubscriptionActivated({
//     refreshProfile, openUpgradeModal
//   })
export function useSubscriptionActivated({ refreshProfile, openUpgradeModal }) {
  const [toast, setToast] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const activated  = params.get('subscription')
    const modalParam = params.get('modal')

    if (activated === 'activated' || modalParam === 'upgrade') {
      cleanParam('subscription')
      cleanParam('modal')
    }

    if (activated === 'activated') {
      setToast(true)
      setTimeout(() => setToast(false), 5000)
      refreshProfile?.()
    }

    if (modalParam === 'upgrade') {
      openUpgradeModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return toast
}
