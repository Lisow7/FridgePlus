import { useEffect, useState } from 'react'

// Hook unique pour gérer le consentement RGPD aux cookies/données.
//
// Stockage : localStorage['fridge-consent-v1']. La clé inclut la version pour
// pouvoir invalider le consentement existant si on modifie la liste des
// catégories ou les sous-traitants — il faut alors bumper CONSENT_VERSION
// ci-dessous, ce qui déclenche le ré-affichage du bandeau.
//
// Catégories :
//   • essential  — toujours true (l'app ne marche pas sans). Pas de toggle.
//   • functional — cache hors-ligne, persistence panier, prefs locales.
//   • audience   — Sentry (monitoring des erreurs applicatives). Désactivé par
//                  défaut ; n'init que si consenti (cf. sentry.js). NB : aucun
//                  Vercel Analytics / GA / pixel — Sentry est le seul outil de
//                  cette catégorie.
//   • voice      — reconnaissance vocale du micro frigo (audio transmis à
//                  Google/Apple via Web Speech API). Consentement INDÉPENDANT
//                  du bandeau cookies global : accepter la voix au 1er usage
//                  ne masque pas le bandeau (cf. `setVoiceConsent` /
//                  `bannerDismissed`). Feature gratuite, sans login.
//
// `bannerDismissed` : pilote l'affichage du bandeau cookies (true uniquement
// quand l'user a agi sur le bandeau/la modale via accept/refuse/save). Permet
// au consentement vocal point-of-use d'être enregistré SANS faire disparaître
// le bandeau si l'user n'a pas encore traité functional/audience.
//
// Implémentation : pattern store + subscribe. Toutes les instances de
// `useConsent` partagent le même état via un module-level store, ce qui
// garantit que la modale qui sauvegarde fait disparaître le bandeau qui
// l'affiche (les deux composants sont des React tree siblings, pas un
// parent/enfant).

export const CONSENT_VERSION = 1
const STORAGE_KEY = 'fridge-consent-v1' // gitleaks:allow

const DEFAULT_CONSENT = {
  version:         CONSENT_VERSION,
  timestamp:       null,
  bannerDismissed: false,
  essential:       true,
  functional:      false,
  audience:        false,
  voice:           false,
  receiptScan:     false,
}

function loadConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== CONSENT_VERSION) return null
    // Migration douce : un enregistrement v1 existant (créé avant l'ajout de
    // bannerDismissed) signifie que l'utilisateur avait déjà traité le bandeau.
    const bannerDismissed = parsed.bannerDismissed ?? true
    return { ...DEFAULT_CONSENT, ...parsed, essential: true, bannerDismissed }
  } catch {
    return null
  }
}

function saveConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {}
}

// ─── Store module-level ──────────────────────────────────────────────────────

const subscribers = new Set()
let currentState = {
  consent:    loadConsent() ?? DEFAULT_CONSENT,
  // Le bandeau s'affiche tant que l'utilisateur ne l'a pas traité.
  hasDecided: (loadConsent() ?? DEFAULT_CONSENT).bannerDismissed === true,
}

function notify() {
  subscribers.forEach(fn => fn(currentState))
}

function setStoreState(partial) {
  currentState = { ...currentState, ...partial }
  notify()
}

// Synchronise entre onglets : si l'user change ses choix dans un autre
// onglet du même navigateur, on met à jour notre état local.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    const next = loadConsent() ?? DEFAULT_CONSENT
    setStoreState({ consent: next, hasDecided: next.bannerDismissed === true })
  })
}

// ─── API publique ────────────────────────────────────────────────────────────

export function getConsentSync() {
  return currentState.consent
}

export function hasConsentedSync(category) {
  // Le consentement vocal et le consentement photo-ticket sont value-based et
  // indépendants du bandeau global : ils ne valent que si explicitement accordés.
  if (category === 'voice' || category === 'receiptScan') return currentState.consent[category] === true
  if (!currentState.hasDecided) return category === 'essential'
  return Boolean(currentState.consent[category])
}

export function useConsent() {
  const [snapshot, setSnapshot] = useState(currentState)

  useEffect(() => {
    subscribers.add(setSnapshot)
    // Resync au mount (au cas où le store ait changé entre l'init et le mount)
    setSnapshot(currentState)
    return () => { subscribers.delete(setSnapshot) }
  }, [])

  function commit(partial) {
    const next = {
      ...currentState.consent,
      ...partial,
      essential:       true,
      version:         CONSENT_VERSION,
      timestamp:       Date.now(),
      bannerDismissed: true,
    }
    saveConsent(next)
    setStoreState({ consent: next, hasDecided: true })
    // Effet collatéral : si l'user retire le consent audience après l'avoir
    // accepté, on stoppe Sentry pour la session courante.
    if (typeof window !== 'undefined' && window.Sentry && !next.audience) {
      try { window.Sentry.close?.() } catch {}
    }
  }

  // Consentement vocal (micro frigo) — indépendant du bandeau cookies global.
  // N'altère PAS bannerDismissed : accepter la voix ne doit pas masquer le
  // bandeau si l'user n'a pas encore traité functional/audience.
  function setVoiceConsent(value) {
    const next = {
      ...currentState.consent,
      voice:     Boolean(value),
      version:   CONSENT_VERSION,
      timestamp: Date.now(),
    }
    saveConsent(next)
    setStoreState({ consent: next, hasDecided: next.bannerDismissed === true })
  }

  // Consentement photo-ticket de caisse (image envoyée à Google Cloud Vision)
  // — indépendant du bandeau cookies global, même mécanisme que setVoiceConsent.
  function setReceiptScanConsent(value) {
    const next = {
      ...currentState.consent,
      receiptScan: Boolean(value),
      version:     CONSENT_VERSION,
      timestamp:   Date.now(),
    }
    saveConsent(next)
    setStoreState({ consent: next, hasDecided: next.bannerDismissed === true })
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setStoreState({ consent: DEFAULT_CONSENT, hasDecided: false })
  }

  return {
    consent:    snapshot.consent,
    hasDecided: snapshot.hasDecided,
    accept: () => commit({ functional: true,  audience: true  }),
    refuse: () => commit({ functional: false, audience: false }),
    save:   (partial) => commit(partial),
    setVoiceConsent,
    setReceiptScanConsent,
    reset,
  }
}
