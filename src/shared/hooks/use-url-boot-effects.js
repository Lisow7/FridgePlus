import { useEffect, useRef, useState } from 'react'

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
// Aussi gère `?modal=upgrade` (deep link app mobile). La fenêtre Premium
// n'est pas un point d'entrée pour un visiteur sans compte (ADR 0006 ; audit
// du 2026-10-04, PREM-08) : le paramètre est lu et retiré tout de suite, et
// l'ouverture attend que la session soit connue — pour un compte seulement.
//
// Usage :
//   const subscriptionToast = useSubscriptionActivated({
//     refreshProfile, openUpgradeModal, user, loading
//   })
export function useSubscriptionActivated({ refreshProfile, openUpgradeModal, user, loading }) {
  const [toast, setToast] = useState(false)
  const upgradeDemande = useRef(new URLSearchParams(window.location.search).get('modal') === 'upgrade')

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!upgradeDemande.current || loading) return
    upgradeDemande.current = false
    if (user) openUpgradeModal()
  }, [loading, user, openUpgradeModal])

  return toast
}
