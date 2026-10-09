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
// consentement aux rapports d'erreurs. Après : import dynamique uniquement dans initSentry()
// si DSN + consent OK. Pour les call-sites pré-init (logError, setSentryUser),
// no-op silencieux tant que le module n'est pas chargé.

import { hasConsentedSync, abonnerAuConsentement } from '@shared/hooks/use-consent'
import { CURRENT_VERSION } from '@shared/lib/version'

// Référence partagée vers le module Sentry une fois importé.
// Reste null si DSN absent, rapports d'erreurs refusés, ou import échoué.
let SentryRef = null

// Ce qui part vers Sentry ne porte ni requête ni fragment d'URL (audit du
// 2026-10-04, RGPD-18) : un lien de restauration de compte porte
// `?restore-account=<jeton>`, le retour de Google `?code=`, les appels REST
// leurs filtres (`?id=eq.<uuid>`). L'origine et le chemin suffisent au débogage.
export function epurerLUrl(url) {
  if (typeof url !== 'string') return url
  const coupes = [url.indexOf('?'), url.indexOf('#')].filter((i) => i >= 0)
  return coupes.length ? url.slice(0, Math.min(...coupes)) : url
}

/** `beforeSend` : l'URL de la page de l'événement, épurée. */
export function epurerLEvenement(evenement) {
  if (!evenement?.request?.url) return evenement
  return { ...evenement, request: { ...evenement.request, url: epurerLUrl(evenement.request.url) } }
}

/** `beforeBreadcrumb` : navigation (`from`, `to`) et appels réseau (`url`), épurés. */
export function epurerLeFilDAriane(miette) {
  const d = miette?.data
  if (!d || !['url', 'from', 'to'].some((cle) => typeof d[cle] === 'string')) return miette
  const data = { ...d }
  for (const cle of ['url', 'from', 'to']) if (typeof data[cle] === 'string') data[cle] = epurerLUrl(data[cle])
  return { ...miette, data }
}

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    if (import.meta.env.DEV) console.info('[sentry] DSN non défini — monitoring inactif')
    return
  }

  // RGPD : Sentry = case « Rapports d'erreurs » (consentement v2, planche
  // n° 2 du 2026-10-06). Activation uniquement si l'user a explicitement consenti. Si l'user accepte plus tard, l'init
  // se relancera au prochain reload (déclenché par le bandeau / panel).
  if (!hasConsentedSync('errors')) {
    if (import.meta.env.DEV) console.info('[sentry] rapports d\'erreurs non consentis — monitoring inactif')
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
    // Ni requête ni fragment d'URL dans les événements et les miettes
    // (RGPD-18) : voir epurerLUrl ci-dessus.
    beforeSend: epurerLEvenement,
    beforeBreadcrumb: epurerLeFilDAriane,
  })

  SentryRef = SentryModule
  // Retrait des rapports d'erreurs : Sentry se ferme pour la session, et plus
  // rien ne part (audit RGPD-05 — le retrait ne coupait rien).
  abonnerAuConsentement((consentement) => { if (!consentement.errors) fermerSentry() })

  // En dev, exposer Sentry sur window pour permettre des tests manuels
  // depuis la console (window.Sentry.captureException(new Error('test'))).
  // Pas exposé en prod pour éviter qu'un attaquant utilise l'API pour
  // saturer le quota d'events.
  if (import.meta.env.DEV) {
    window.Sentry = SentryModule
    console.info('[sentry] initialisé en dev — window.Sentry disponible pour tests')
  }
}

export function fermerSentry() {
  if (!SentryRef) return
  try { SentryRef.close?.() } catch {}
  SentryRef = null
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
//     initialisé : DSN manquant ou rapports d'erreurs refusés).
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
