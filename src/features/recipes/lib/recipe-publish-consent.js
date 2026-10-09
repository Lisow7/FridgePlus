// R-03 — preuve de consentement à la publication communautaire.
// Embarquée dans buildRecipe() et persistée en colonnes dédiées par le repo.
import { LEGAL_CONSENT_VERSION } from '@shared/lib/legal-version'

/**
 * Construit la preuve de consentement à publier.
 *
 * INVARIANT : un horodatage frais n'est écrit QUE si un nouveau consentement
 * vient d'être donné (dialog de publication confirmé avec la case cochée).
 * Sinon on préserve la preuve existante (`initialRecipe`) — pour ne pas
 * falsifier (édition admin ≠ consentement auteur) ni effacer (régression).
 *
 * @param {boolean} consentJustGiven — true uniquement quand l'appel provient de
 *   la confirmation du dialog de publication (2 cases cochées).
 * @param {{ published_consent_at?: string|null, published_consent_version?: string|null }|null} initialRecipe
 * @returns {{ published_consent_at: string|null, published_consent_version: string|null }}
 */
export function buildPublishConsent(consentJustGiven, initialRecipe) {
  if (consentJustGiven) {
    return {
      published_consent_at: new Date().toISOString(),
      published_consent_version: LEGAL_CONSENT_VERSION,
    }
  }
  // Préserve la preuve existante (édition sans re-consentement) ou NULL si jamais consenti.
  return {
    published_consent_at: initialRecipe?.published_consent_at ?? null,
    published_consent_version: initialRecipe?.published_consent_version ?? null,
  }
}
