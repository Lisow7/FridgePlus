// Identifiant anonyme d'invité pour relier le funnel pré-inscription.
// Gaté consentement « usage » (statistiques d'usage, RGPD) : pas de génération sans consentement.
// uuid aléatoire (pas de fingerprinting, pas de PII) ; disparaît si l'invité
// efface ses données.
import { hasConsentedSync } from '@shared/hooks/use-consent'

const KEY = 'fridge-anon-id'

export function getAnonId() {
  if (!hasConsentedSync('usage')) return null
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return null
  }
}
