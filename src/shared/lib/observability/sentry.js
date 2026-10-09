// Sentry — monitoring d'erreurs de production.
//
// Capture les erreurs JS non gérées + les promesses rejetées + les
// erreurs React (ErrorBoundary). Les events sont envoyés vers le projet
// Sentry hébergé en région UE (Allemagne), conformément au RGPD.
//
// Activé uniquement si VITE_SENTRY_DSN est défini. En dev local sans DSN,
// Sentry reste inactif (pas de noise sur la console).
//
// Phase 11 PR P11.c.2 — Import dynamique de `@sentry/react`.
// Avant : `import * as Sentry` au top → le SDK (27,6 KiB compressed)
// était embarqué dans le bundle init même si l'user n'a pas donné le
// consent audience. Après : import dynamique uniquement dans initSentry()
// si DSN + consent OK. Pour les call-sites pré-init (logError, setSentryUser),
// no-op silencieux tant que le module n'est pas chargé.

import { hasConsentedSync } from '@shared/hooks/use-consent'
import { CURRENT_VERSION } from '@shared/lib/version'

// Référence partagée vers le module Sentry une fois importé.
// Reste null si DSN absent, consent audience non donné, ou import échoué.
let SentryRef = null

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    if (import.meta.env.DEV) console.info('[sentry] DSN non défini — monitoring inactif')
    return
  }

  // RGPD : Sentry = catégorie « Mesure d'audience ». Activation uniquement
  // si l'user a explicitement consenti. Si l'user accepte plus tard, l'init
  // se relancera au prochain reload (déclenché par le bandeau / panel).
  if (!hasConsentedSync('audience')) {
    if (import.meta.env.DEV) console.info('[sentry] consentement audience non donné — monitoring inactif')
    return
  }

  // Import dynamique : `@sentry/react` n'arrive plus dans le bundle init.
  // Charge le chunk uniquement quand DSN + consent OK. Coût ~27 KiB
  // compressed, ~80 KiB uncompressed, mais hors chemin critique.
  let SentryModule
  try {
    SentryModule = await import('@sentry/react')
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[sentry] échec chargement dynamique', err)
    return
  }

  SentryModule.init({
    dsn,
    // Environnement : permet de séparer les events dev / prod dans le dashboard
    environment: import.meta.env.MODE, // 'development' ou 'production'
    // Release tracking : groupe les events Sentry par version de
    // l'app pour identifier rapidement quelle release a introduit un bug.
    // Format `fridge-plus@x.y.z` — préfixe pour différencier d'autres apps
    // si le projet Sentry était partagé un jour.
    release: `fridge-plus@${CURRENT_VERSION}`,
    // Échantillonnage des perfs : 0 = aucun trace performance (free tier limité)
    // À monter à 0.1 (10%) en prod si on veut suivre la perf.
    tracesSampleRate: 0,
    // Ignore les erreurs cosmétiques connues (extensions navigateur, ResizeObserver…)
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      // Erreurs liées aux extensions Chrome
      /chrome-extension/i,
      /moz-extension/i,
    ],
    // Pas de PII (Personally Identifiable Information) collectée par défaut.
    // Le user context (id seul, pas email) est attaché après login via
    // setSentryUser() ci-dessous, depuis AuthContext.
    sendDefaultPii: false,
  })

  SentryRef = SentryModule

  // En dev, exposer Sentry sur window pour permettre des tests manuels
  // depuis la console (window.Sentry.captureException(new Error('test'))).
  // Pas exposé en prod pour éviter qu'un attaquant utilise l'API pour
  // saturer le quota d'events.
  if (import.meta.env.DEV) {
    window.Sentry = SentryModule
    console.info('[sentry] initialisé en dev — window.Sentry disponible pour tests')
  }
}

// Helpers RGPD-friendly pour attacher / détacher le user context
// dans Sentry. On stocke uniquement l'id Supabase (UUID), jamais l'email
// ni le username, pour pouvoir corréler des crashes à un compte sans
// collecter de PII supplémentaire (Sentry retient déjà l'IP par défaut,
// mais sendDefaultPii:false les masque côté serveur).
//
// No-op si Sentry n'a pas été chargé (DSN absent, consent refusé, ou
// init en cours) — pas besoin de check côté caller.
export function setSentryUser(userId) {
  if (!userId || !SentryRef) return
  SentryRef.setUser({ id: userId })
}

export function clearSentryUser() {
  if (!SentryRef) return
  SentryRef.setUser(null)
}

// Sprint 4 PR S4.c — Helper unifié console.error + Sentry.captureException.
//
// Pourquoi ce helper :
//   - Sentry ne capture que les erreurs non gérées (window.onerror /
//     unhandledrejection / ErrorBoundary). Les erreurs catchées et loguées
//     via `console.error` passent sous le radar.
//   - Avant ce helper, 26 fichiers utilisaient `console.error` sans
//     remonter à Sentry → blind spot en prod.
//
// Comportement :
//   - Toujours `console.error` (debug local + Vercel logs).
//   - Toujours `Sentry.captureException` (no-op silencieux si Sentry non
//     initialisé : DSN manquant ou consent audience refusé).
//   - `context` accepte un objet libre : `{ tag: 'auth.deleteAccount',
//     userId: 'xxx', endpoint: '/functions/v1/...' }`. Le tag part en
//     `tags` Sentry (groupable), le reste en `extra` (debug payload).
//
// Usage :
//   try { … } catch (err) { logError(err, { tag: 'auth.deleteAccount' }) }
export function logError(err, context = {}) {
  const tag = context && typeof context === 'object' ? context.tag : undefined
  console.error(tag ? `[${tag}]` : '[error]', err, context)
  if (!SentryRef) return
  try {
    SentryRef.captureException(err, {
      tags: tag ? { tag } : undefined,
      extra: context,
    })
  } catch {
    // Sentry chargé mais captureException a throw : no-op
  }
}
