import { useEffect, useState } from 'react'

// Hook unique pour gérer le consentement RGPD aux cookies/données.
//
// Stockage : localStorage['fridge-consent-v1'] (le nom de la clé est resté ;
// c'est le champ `version` qui compte). Changer la liste des catégories ou
// des outils exige de monter CONSENT_VERSION : le bandeau revient pour tous.
//
// Catégories (version 2, décision du 2026-10-06 — la case « Mesure
// d'audience » se disait « Sentry seul, anonyme » et autorisait aussi un suivi
// d'usage rattaché au compte ; « Fonctionnels » ne commandait rien) :
//   • essential  — toujours true (l'app ne marche pas sans). Pas de toggle.
//   • errors     — Sentry : les erreurs de l'app, rattachées à l'identifiant du
//                  compte (jamais l'e-mail). N'init que si consenti (sentry.js).
//   • usage      — statistiques d'usage : les étapes franchies dans l'app
//                  (`product_events`, gardées 13 mois), rattachées au compte ou
//                  à un identifiant anonyme (track.js, anon-id.js).
//   • voice      — reconnaissance vocale du micro frigo (audio transmis à
//                  Google/Apple via Web Speech API). Consentement INDÉPENDANT
//                  du bandeau cookies global : accepter la voix au 1er usage
//                  ne masque pas le bandeau (cf. `setVoiceConsent` /
//                  `bannerDismissed`). Feature gratuite, sans login.
//
// `bannerDismissed` : pilote l'affichage du bandeau cookies (true uniquement
// quand l'user a agi sur le bandeau/la modale via accept/refuse/save). Permet
// au consentement vocal point-of-use d'être enregistré SANS faire disparaître
// le bandeau si l'user n'a pas encore traité errors/usage.
//
// Implémentation : pattern store + subscribe. Toutes les instances de
// `useConsent` partagent le même état via un module-level store, ce qui
// garantit que la modale qui sauvegarde fait disparaître le bandeau qui
// l'affiche (les deux composants sont des React tree siblings, pas un
// parent/enfant).

export const CONSENT_VERSION = 2
const STORAGE_KEY = 'fridge-consent-v1' // gitleaks:allow
// L'identifiant anonyme du suivi d'usage (`observability/anon-id.js`) : il
// part avec le consentement « usage » (retrait ou expiration).
const CLE_ANON_ID = 'fridge-anon-id'

// Le choix du bandeau EXPIRE (audit du 2026-10-04, RGPD-05 ; recommandation de
// la CNIL : redemander au bout de 6 mois). Il a sa PROPRE date, `decisionAt` :
// un consentement vocal renouvelé (qui touche `timestamp`) ne doit pas
// prolonger un choix de cookies ancien. Les consentements d'usage (micro,
// photo de ticket) ne sont pas des cookies : ils restent.
const DUREE_DU_CHOIX_MS = 182 * 24 * 60 * 60 * 1000

function oublierLIdentifiantAnonyme() {
  try { localStorage.removeItem(CLE_ANON_ID) } catch {}
}

const DEFAULT_CONSENT = {
  version:         CONSENT_VERSION,
  timestamp:       null,
  bannerDismissed: false,
  essential:       true,
  errors:          false,
  usage:           false,
  voice:           false,
  receiptScan:     false,
}

function loadConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Un choix d'une AUTRE version (la version 1 : une seule case « audience »)
    // ne vaut plus pour les cookies : le bandeau revient, l'identifiant du
    // suivi d'usage part. Les accords d'usage (micro, photo) restent.
    if (parsed?.version !== CONSENT_VERSION) {
      if (!parsed || typeof parsed !== 'object') return null
      oublierLIdentifiantAnonyme()
      return { ...DEFAULT_CONSENT, voice: parsed.voice === true, receiptScan: parsed.receiptScan === true, timestamp: parsed.timestamp ?? null }
    }
    const decideLe = parsed.decisionAt ?? parsed.timestamp
    if (parsed.bannerDismissed !== false && decideLe && Date.now() - decideLe > DUREE_DU_CHOIX_MS) {
      oublierLIdentifiantAnonyme()
      return { ...DEFAULT_CONSENT, voice: parsed.voice === true, receiptScan: parsed.receiptScan === true, timestamp: parsed.timestamp ?? null }
    }
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
// Abonnés au CONSENTEMENT lui-même (hors composants React) : Sentry s'y ferme
// au retrait — il ne pouvait pas, le code appelait `window.Sentry`, qui
// n'existe qu'en développement (RGPD-05).
const abonnesAuConsentement = new Set()
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
  abonnesAuConsentement.forEach((fn) => { try { fn(currentState.consent) } catch {} })
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

// Rend une fonction de désabonnement.
export function abonnerAuConsentement(fn) {
  abonnesAuConsentement.add(fn)
  return () => abonnesAuConsentement.delete(fn)
}

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
      decisionAt:      Date.now(),
      bannerDismissed: true,
    }
    // Sans « usage », l'identifiant anonyme du suivi d'usage part aussi.
    if (!next.usage) oublierLIdentifiantAnonyme()
    saveConsent(next)
    // Prévient aussi les abonnés : Sentry se ferme au retrait (sentry.js).
    setStoreState({ consent: next, hasDecided: true })
  }

  // Consentement vocal (micro frigo) — indépendant du bandeau cookies global.
  // N'altère PAS bannerDismissed : accepter la voix ne doit pas masquer le
  // bandeau si l'user n'a pas encore traité errors/usage.
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
    accept: () => commit({ errors: true,  usage: true  }),
    refuse: () => commit({ errors: false, usage: false }),
    save:   (partial) => commit(partial),
    setVoiceConsent,
    setReceiptScanConsent,
    reset,
  }
}
