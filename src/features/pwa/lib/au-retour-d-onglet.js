import { shouldCheckForUpdate } from './should-check-for-update'

// Ce que fait la bannière de mise à jour quand on revient sur l'onglet.
//
// 1. Une version attend encore : la bannière revient. « Plus tard » la faisait
//    disparaître pour toute la vie de l'onglet, et l'ancienne version restait
//    en place (audit du 2026-10-04, SEO-08).
// 2. Chercher une version plus récente, au plus une fois par `delaiMs` : un
//    onglet resté longtemps en arrière-plan rattrape un déploiement sans
//    attendre la vérification horaire.
export function creerRetourDOnglet({ registration, verifier, onVersionEnAttente, document, delaiMs, maintenant = Date.now }) {
  let derniereVerification = null
  return () => {
    if (document.visibilityState !== 'visible') return
    if (registration.waiting) onVersionEnAttente()
    const t = maintenant()
    if (!shouldCheckForUpdate(derniereVerification, t, delaiMs)) return
    derniereVerification = t
    verifier()
  }
}
