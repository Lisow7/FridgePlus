import { expect } from '@playwright/test'

// Harnais de mocks Supabase pour les E2E.
//
// POURQUOI DES MOCKS : il n'existe qu'un seul projet Supabase (la production)
// et la CI ne possede aucun secret Supabase. Faire tourner une inscription ou
// une suppression de compte contre la prod y creerait de vrais comptes.
//
// EFFET DE BORD VOULU, ET IMPORTANT POUR LA SECURITE : ce socle intercepte
// TOUT appel `rest/v1`, `auth/v1` et `functions/v1`. Meme lance en local avec
// un `.env.local` portant les vraies cles, un test ne peut donc pas atteindre
// la base de production ni declencher une edge function reelle. C'est une
// garantie du harnais, pas un hasard de configuration.
//
// ⚠️ ORDRE D'ENREGISTREMENT — la regle qui fait tenir tout le fichier :
// Playwright evalue les routes dans l'ordre INVERSE de leur enregistrement
// (« the last registered route can always override all the previous ones »,
// cf. playwright.dev/docs/api/class-route). `installSupabaseMocks()` doit donc
// etre appele EN PREMIER : les mocks de scenario poses ensuite le masqueront.
// L'ordre inverse ferait avaler chaque mock par l'attrape-tout.
//
// ⚠️ Un handler n'intercepte que les requetes emises APRES son enregistrement.
// Tout doit donc etre installe avant `page.goto()`.
//
// Spec : la conception « e2e-parcours-critiques » du 2026-08-06

// Les 6 endpoints REST interroges au seul chargement de l'app.
// Mesure le 2026-08-06 sur les traces reseau. Si un 7e apparait, le test
// canari de signup-funnel.spec.js tombera — c'est exactement son role.
export const BOOT_TABLES = [
  'custom_recipes',
  'feature_flags',
  'fridge_layouts',
  'ingredients',
  'recipes_unified',
  'taxonomies',
]

// Endpoints personnels interroges EN PLUS des 6 precedents des qu'une session
// existe (mesure le 2026-08-06, complete le 2026-08-07). Ils ne sont attendus
// qu'apres signedInAs() : les laisser dans la liste globale masquerait un
// appel authentifie partant a tort depuis un parcours invite.
//
// ⚠️ `user_stock` manquait depuis l'origine. Le canari ne l'a jamais signale
// parce que l'unique test authentifie de signup-funnel.spec.js pose
// `mockStockUpsert()`, qui masque le socle sur cette table. Mesure sur
// /profile/compte le 2026-08-07 : c'est bien un 7e endpoint de demarrage.
const AUTH_BOOT_TABLES = [
  'basket_items',
  'cooking_logs',
  'notifications',
  'support_tickets',
  'user_favorites',
  'user_leftovers',
  'user_stock',
]

const unexpected = new Map()
// Tables supplementaires tolerees pour une page donnee (alimentee par signedInAs).
const extraExpected = new Map()

// Extrait le nom de table/endpoint d'une URL Supabase, sans les query params.
function endpointOf(url) {
  const { pathname } = new URL(url)
  const after = pathname.split('/rest/v1/')[1]
    ?? pathname.split('/auth/v1/')[1]
    ?? pathname.split('/functions/v1/')[1]
    ?? ''
  return after.split('?')[0]
}

/**
 * Installe le socle. A APPELER EN PREMIER (voir l'avertissement en tete).
 * @param {import('@playwright/test').Page} page
 */
export async function installSupabaseMocks(page) {
  unexpected.set(page, [])
  extraExpected.set(page, [])

  await page.route('**/rest/v1/**', (route) => {
    const table = endpointOf(route.request().url())
    // Les requetes de demarrage echouent DEJA en CI (aucune cle Supabase :
    // le client retombe sur placeholder.supabase.co) et l'app bascule sur ses
    // donnees statiques — c'est ainsi que les 9 tests existants passent.
    // On preserve ce comportement : les servir a vide viderait le frigo.
    if (BOOT_TABLES.includes(table)) return route.abort()
    if (extraExpected.get(page)?.includes(table)) return route.abort()
    unexpected.get(page)?.push(`${route.request().method()} rest/${table}`)
    return route.abort()
  })

  await page.route('**/auth/v1/**', (route) => {
    unexpected.get(page)?.push(`${route.request().method()} auth/${endpointOf(route.request().url())}`)
    return route.abort()
  })

  // 3e attrape-tout : les EDGE FUNCTIONS. Absent jusqu'au 2026-08-07, ce qui
  // rendait le garde-fou aveugle sur elles et faisait mentir la garantie de
  // securite ci-dessus : lance en local avec un `.env.local` de production, un
  // appel non mocke partait POUR DE VRAI (constate en ecrivant le test du
  // garde-fou). Sur un parcours de suppression de compte, c'est le defaut a
  // fermer en premier.
  await page.route('**/functions/v1/**', (route) => {
    unexpected.get(page)?.push(`${route.request().method()} functions/${endpointOf(route.request().url())}`)
    return route.abort()
  })
}

/**
 * Neutralise les deux overlays du premier lancement.
 *
 * Sans cela, DEUX elements interceptent successivement les clics, chacun avec
 * un message d'erreur qui ne designe pas la vraie cause :
 *   1. <div role="dialog" aria-modal="true" aria-label="Bienvenue en cuisine !">
 *   2. <div role="dialog" aria-label="🍪 Cookies et donnees">
 *
 * Meme contenu que le helper local de receipt-scan.spec.js et
 * modal-back-button.spec.js, remonte ici pour cesser de le dupliquer.
 * La `version` doit correspondre a CONSENT_VERSION (use-consent.js:34), sinon
 * `loadConsent()` ignore l'enregistrement et le bandeau revient.
 *
 * A appeler avant `page.goto()`, comme tout le reste.
 */
export async function skipOnboardingOverlays(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-welcome-seen-v1', '1')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, timestamp: Date.now(), bannerDismissed: true,
      essential: true, errors: false, usage: false, voice: false, receiptScan: false,
    }))
  })
}

// ─── Mocks de scenario ───────────────────────────────────────────────────
// A poser APRES installSupabaseMocks() : enregistres en dernier, ils sont
// evalues en premier et masquent donc le socle.

const signupCounter = new Map()
const rpcCallLog = new Map()

/**
 * POST rest/v1/rpc/<nom> — une fonction de la base.
 *
 * `reponse` est le corps JSON rendu (un scalaire pour une fonction qui rend
 * un booleen ou une date). `status` >= 400 simule un refus de la base.
 * Les appels sont gardes, dans l'ordre, pour `rpcCalls()`.
 */
export async function mockRpc(page, nom, reponse, { status = 200 } = {}) {
  if (!rpcCallLog.has(page)) rpcCallLog.set(page, [])
  await page.route(`**/rest/v1/rpc/${nom}**`, (route) => {
    let args = null
    try { args = JSON.parse(route.request().postData() ?? 'null') } catch { /* corps illisible */ }
    rpcCallLog.get(page)?.push({ nom, args })
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(reponse) })
  })
}

/** Appels captures par mockRpc(), dans l'ordre ; filtrables par nom de fonction. */
export function rpcCalls(page, nom = null) {
  const tous = rpcCallLog.get(page) ?? []
  return nom ? tous.filter((appel) => appel.nom === nom) : tous
}

// « Ce pseudo est-il libre ? » — depuis le 2026-10-04 la question est posee a
// la fonction `username_available` (rest/v1/rpc), plus a la table `profiles`,
// qu'un visiteur ne peut pas lire : l'ancien mock rendait ici une ligne de
// profil que la vraie base n'aurait jamais rendue, et le test passait sur une
// reponse impossible (audit CPT-09).

/** Le pseudo est libre : la creation doit pouvoir continuer. */
export async function mockUsernameAvailable(page) {
  await mockRpc(page, 'username_available', true)
}

/** Le pseudo est pris ou reserve : la creation doit s'arreter avant signUp. */
export async function mockUsernameTaken(page) {
  await mockRpc(page, 'username_available', false)
}

/**
 * POST auth/v1/signup — succes SANS session.
 * La confirmation d'e-mail est active (verifie sur auth.users le 2026-08-06 :
 * les 3 comptes crees par e-mail ont tous un confirmation_sent_at), donc
 * l'utilisateur n'est PAS connecte au retour.
 */
export async function mockSignupSuccess(page) {
  signupCounter.set(page, 0)
  signupBodyLog.set(page, [])
  await page.route('**/auth/v1/signup**', (route) => {
    signupCounter.set(page, (signupCounter.get(page) ?? 0) + 1)
    try { signupBodyLog.get(page)?.push(JSON.parse(route.request().postData() ?? '{}')) } catch { /* corps illisible */ }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000002',
        email: 'a@b.co',
        confirmation_sent_at: new Date().toISOString(),
        user_metadata: {},
      }),
    })
  })
}

/**
 * Inscription refusée par la base : ce que le service d'authentification rend
 * quand un déclencheur de `auth.users` lève (adresse effacée pendant un
 * bannissement, migration 20261006_bannis_ne_se_reinscrivent_pas.sql) — un
 * 500 générique, sans le motif.
 */
export async function mockSignupRefusedByDatabase(page) {
  signupCounter.set(page, 0)
  await page.route('**/auth/v1/signup**', (route) => {
    signupCounter.set(page, (signupCounter.get(page) ?? 0) + 1)
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 500, error_code: 'unexpected_failure', msg: 'Database error saving new user' }),
    })
  })
}

const signupBodyLog = new Map()

/** Corps envoyes a auth/v1/signup depuis mockSignupSuccess() (`data` = les metadonnees). */
export function signupBodies(page) {
  return signupBodyLog.get(page) ?? []
}

/** Nombre d'appels a auth/v1/signup depuis mockSignupSuccess(). */
export function signupCalls(page) {
  return signupCounter.get(page) ?? 0
}

// ─── Session simulee ─────────────────────────────────────────────────────

const stockCalls = new Map()

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Forge un JWT structurellement valide.
 *
 * supabase-js decode le payload cote client SANS verifier la signature : un
 * token forge suffit donc. La signature est volontairement une chaine inerte —
 * ce token n'a aucune valeur hors de ce contexte de test.
 *
 * ⚠️ Verifie par mutation le 2026-08-06 : c'est `session.expires_at` qui
 * commande, PAS l'`exp` encode dans le JWT. Un JWT expire avec un
 * `expires_at` valide ne change rien ; l'inverse invalide la session. L'`exp`
 * est garde coherent par proprete, mais ce n'est pas lui qui porte l'effet.
 *
 * ⚠️ La signature DOIT avoir une longueur base64url possible, c'est-a-dire
 * jamais congrue a 1 modulo 4. L'ancienne valeur en faisait 41 (41 % 4 === 1) :
 * `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`, appele au montage de
 * MfaCard (use-mfa.js:36), levait alors `AuthInvalidJwtError` en rejet non
 * gere, ce qui supprimait silencieusement toute la branche MFA de la page
 * Compte. Mesure par mutation le 2026-08-07 : avec une longueur valide,
 * l'exception disparait et AUCUNE requete reseau supplementaire n'apparait
 * (`listFactors` et `getAAL` lisent la session locale).
 */
export function fakeJwt(sub, email, aal) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub, email, exp, role: 'authenticated', aud: 'authenticated', ...(aal && { aal }) }),
    'signature-inerte-non-verifiee-cote-client-0',
  ].join('.')
}

/**
 * Pose une session Supabase valide et sert le profil associe.
 *
 * ⚠️ POURQUOI ON NE POSE PAS SIMPLEMENT UNE CLE `sb-<ref>-auth-token` :
 * la ref derive de VITE_SUPABASE_URL, que **Vite** lit depuis `.env.local`
 * mais que **Node** ne voit pas. `process.env.VITE_SUPABASE_URL` est donc
 * vide cote Playwright, alors que l'app peut tourner sur la vraie ref. Une
 * cle codee en dur marcherait en CI (`placeholder`) et echouerait en local :
 * l'app resterait en mode invite, l'ajout partirait dans localStorage, et
 * AUCUNE requete n'apparaitrait — un echec muet, sans rapport apparent
 * avec sa cause. Constate le 2026-08-06.
 *
 * On intercepte donc la LECTURE : toute cle finissant par `-auth-token`
 * renvoie la session, quelle que soit la ref du projet.
 */
const profileWriteLog = new Map()

export async function signedInAs(page, {
  id = '00000000-0000-0000-0000-000000000002',
  email = 'a@b.co',
  username = 'Foodie_42',
  // Colonnes de profil en plus de `id` et `username` (ex. un pseudo pas
  // encore confirme : { username_confirmed: false }).
  profile = {},
  // Double authentification : le niveau de la session ('aal1' | 'aal2') et
  // les facteurs du compte (ex. [{ id, factor_type: 'totp', status: 'verified' }]).
  aal,
  factors,
} = {}) {
  // ⚠️ `expires_at` DOIT rester dans le futur. Verifie par mutation : avec une
  // valeur passee, l'app retombe en mode invite, l'ajout part dans
  // localStorage et AUCUNE requete n'est emise — le test echoue alors sur
  // « 0 upsert », un symptome qui ne designe pas sa cause.

  // Une session ouvre le chargement des donnees personnelles : ces endpoints
  // deviennent attendus, mais seulement a partir d'ici.
  extraExpected.set(page, [...(extraExpected.get(page) ?? []), ...AUTH_BOOT_TABLES])

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365

  const session = {
    access_token: fakeJwt(id, email, aal),
    refresh_token: 'refresh-inerte-non-utilise',
    expires_at: expiresAt,
    expires_in: 60 * 60 * 24 * 365,
    token_type: 'bearer',
    user: {
      id, email, aud: 'authenticated', role: 'authenticated',
      user_metadata: { username },
      app_metadata: { provider: 'email' },
      ...(factors && { factors }),
    },
  }

  await page.addInitScript((value) => {
    const raw = JSON.stringify(value)
    const original = window.localStorage.getItem.bind(window.localStorage)
    window.localStorage.getItem = (key) =>
      (typeof key === 'string' && key.endsWith('-auth-token')) ? raw : original(key)
  }, session)

  // Le frigo, les favoris et les recettes du compte : VIDES, mais lus. Laissés
  // au socle, ces appels seraient abandonnés ; depuis le 2026-10-04 l'app le dit
  // alors (« Ton frigo, tes favoris et tes recettes n'ont pas pu être
  // chargés », avec un bouton), environ 8 s après le chargement, le temps des
  // nouvelles tentatives de la bibliothèque. Ce message est juste — la base ne
  // répond pas — mais il n'a rien à faire dans un parcours qui teste autre
  // chose. Un mock de scénario posé après celui-ci (`mockStockUpsert`, par
  // exemple) le masque.
  for (const table of ['user_stock', 'user_favorites', 'custom_recipes']) {
    await page.route(`**/rest/v1/${table}**`, (route) =>
      route.fulfill({ status: route.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }))
  }

  profileWriteLog.set(page, [])
  await page.route('**/rest/v1/profiles**', (route) => {
    const req = route.request()
    // Les ecritures (PATCH) sont gardees pour `profileWrites()` : horodatage
    // de connexion, choix du pseudo…
    if (req.method() === 'PATCH') {
      try { profileWriteLog.get(page)?.push(JSON.parse(req.postData() ?? '{}')) } catch { /* corps illisible */ }
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id, username, ...profile }),
    })
  })
}

/** Corps des ecritures (PATCH) vers `profiles` depuis signedInAs(), dans l'ordre. */
export function profileWrites(page) {
  return profileWriteLog.get(page) ?? []
}

/** Capture les upserts vers user_stock sans jamais les envoyer. */
export async function mockStockUpsert(page) {
  stockCalls.set(page, [])
  await page.route('**/rest/v1/user_stock**', (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      try {
        const body = JSON.parse(req.postData() ?? '{}')
        // PostgREST accepte un objet ou un tableau d'objets.
        for (const row of Array.isArray(body) ? body : [body]) stockCalls.get(page)?.push(row)
      } catch { /* corps illisible : on n'enregistre rien plutot que de deviner */ }
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

/** Lignes envoyees a user_stock depuis mockStockUpsert(). */
export function stockUpserts(page) {
  return stockCalls.get(page) ?? []
}

// ─── Suppression et restauration de compte ───────────────────────────────

const DEFAULT_UID = '00000000-0000-0000-0000-000000000002'
const DEFAULT_EMAIL = 'a@b.co'

const activityRows = new Map()
const deleteCalls = new Map()

/**
 * GET auth/v1/user — sert l'utilisateur courant.
 *
 * `logAuditAction()` (audit.js:165) commence par `supabase.auth.getUser()`.
 * Sans ce mock, le socle abandonne l'appel, la fonction rend « Not
 * authenticated » et AUCUNE trace RGPD n'est ecrite : on testerait le parcours
 * RGPD sur une application dont la journalisation est eteinte.
 */
export async function mockAuthUser(page, { id = DEFAULT_UID, email = DEFAULT_EMAIL } = {}) {
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id, email, aud: 'authenticated', role: 'authenticated' }),
    }),
  )
}

/**
 * POST auth/v1/token — la re-authentification exigee avant suppression
 * (profile-account-page.jsx:211).
 *
 * `ok: false` rend un 400 `invalid_grant` au format GoTrue, c'est-a-dire un
 * vrai refus d'authentification. Laisser le socle abandonner la requete
 * produirait le meme message a l'ecran, mais simulerait une panne reseau : le
 * test ne prouverait alors pas que le mot de passe est verifie.
 */
export async function mockReauth(page, {
  ok = true, id = DEFAULT_UID, email = DEFAULT_EMAIL, username = 'Foodie_42',
} = {}) {
  await page.route('**/auth/v1/token**', (route) => {
    if (!ok) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: fakeJwt(id, email),
        refresh_token: 'refresh-inerte-non-utilise',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id, email, aud: 'authenticated', role: 'authenticated',
          user_metadata: { username }, app_metadata: { provider: 'email' },
        },
      }),
    })
  })
}

/** POST rest/v1/activity_logs — capture les traces RGPD sans les envoyer. */
export async function mockActivityLogs(page) {
  activityRows.set(page, [])
  await page.route('**/rest/v1/activity_logs**', (route) => {
    try {
      const body = JSON.parse(route.request().postData() ?? '{}')
      for (const row of Array.isArray(body) ? body : [body]) activityRows.get(page)?.push(row)
    } catch { /* corps illisible : on n'enregistre rien plutot que de deviner */ }
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })
}

/**
 * Lignes envoyees a activity_logs depuis mockActivityLogs().
 *
 * ⚠️ FILTRER PAR `action`, JAMAIS COMPTER LE TOTAL : le montage de la page
 * Compte emet DEUX `profile_data_viewed`, parce que React StrictMode invoque
 * deux fois les effets en developpement — et les E2E tournent contre
 * `npm run dev`. Ce doublon n'existe pas en production et n'est pas un defaut
 * applicatif : contrairement au double upsert corrige en #958, l'appel est ici
 * dans un `useEffect`, pas dans un updater `setState`.
 */
export function activityLogRows(page) {
  return activityRows.get(page) ?? []
}

/**
 * POST functions/v1/delete-account — l'edge function de soft-delete.
 *
 * Appelee en `fetch` DIRECT (auth-provider.jsx:423) et non via
 * `functions.invoke` : c'est pourquoi l'interception se fait par CHEMIN, ce
 * qui couvre les deux formes d'appel.
 */
export async function mockDeleteAccount(page, { status = 200, body = null } = {}) {
  deleteCalls.set(page, [])
  await page.route('**/functions/v1/delete-account**', (route) => {
    const req = route.request()
    let parsed = null
    try { parsed = JSON.parse(req.postData() ?? 'null') } catch { /* corps illisible */ }
    deleteCalls.get(page)?.push({
      method: req.method(),
      authorization: req.headers().authorization ?? '',
      body: parsed,
    })
    const payload = body ?? (status < 400
      ? { ok: true, retentionDays: 30, expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() }
      : { error: 'server_error' })
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
  })
}

/** Appels captures par mockDeleteAccount() — un tableau, pour en compter le nombre. */
export function deleteAccountCalls(page) {
  return deleteCalls.get(page) ?? []
}

const restoreCalls = new Map()

/**
 * POST functions/v1/restore-account — appelee par le hook de lien e-mail
 * (use-restore-account.js) via `functions.invoke`.
 *
 * Sur echec, `restoreAccount()` (auth-provider.jsx:264) relit le CORPS de la
 * reponse pour en extraire `error` : un statut 4xx sans corps JSON produirait
 * le message generique au lieu du message specifique.
 */
export async function mockRestoreAccount(page, { outcome = 'ok' } = {}) {
  restoreCalls.set(page, [])
  await page.route('**/functions/v1/restore-account**', (route) => {
    try {
      const body = JSON.parse(route.request().postData() ?? '{}')
      if (body?.token) restoreCalls.get(page)?.push(body.token)
    } catch { /* corps illisible : on n'enregistre rien plutot que de deviner */ }
    if (outcome === 'ok') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: outcome }),
    })
  })
}

/** Jetons transmis a restore-account depuis mockRestoreAccount(). */
export function restoreAccountCalls(page) {
  return restoreCalls.get(page) ?? []
}

// ─── Panier partage ──────────────────────────────────────────────────────

const sharedBasketReqs = new Map()

/**
 * GET rest/v1/shared_baskets — la lecture publique d'un panier partage
 * (shared-baskets.js:44, via `.maybeSingle()`).
 *
 * Quatre issues, qui correspondent a quatre causes REELLES et distinctes :
 *  - `ok`            : la liste existe ;
 *  - `not_found`     : `.maybeSingle()` rend `null` — ligne absente, ou
 *                      expiree et filtree par la RLS ;
 *  - `server_error`  : 500, donc `error` truthy cote supabase-js ;
 *  - `network`       : requete abandonnee. ⚠️ Mesure le 2026-08-07 :
 *                      supabase-js LEVE dans ce cas au lieu de renseigner
 *                      `error`. On abandonne ici plutot que de laisser faire
 *                      le socle, sinon l'appel compterait comme inattendu et
 *                      `assertNoUnmockedCalls` echouerait sans rapport avec ce
 *                      que le test verifie.
 */
export async function mockSharedBasket(page, { outcome = 'ok', payload = null } = {}) {
  sharedBasketReqs.set(page, [])
  await page.route('**/rest/v1/shared_baskets**', (route) => {
    sharedBasketReqs.get(page)?.push(route.request().url())
    if (outcome === 'network') return route.abort()
    if (outcome === 'server_error') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'internal error' }),
      })
    }
    // `.maybeSingle()` attend UN objet, pas un tableau : `null` signifie
    // « aucune ligne », ce que rend aussi une ligne filtree par la RLS.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: outcome === 'not_found' ? 'null' : JSON.stringify(payload),
    })
  })
}

/** URL recues par mockSharedBasket() — pour verifier l'identifiant demande. */
export function sharedBasketRequests(page) {
  return sharedBasketReqs.get(page) ?? []
}

/** Liste des appels Supabase partis sans avoir ete explicitement mockes. */
export function unexpectedCalls(page) {
  return unexpected.get(page) ?? []
}

/**
 * Echoue si un appel Supabase inattendu est parti.
 * Sans ce garde-fou, un test peut passer parce que le fallback statique a
 * repondu a la place du mock — un vert aveugle.
 */
export function assertNoUnmockedCalls(page) {
  expect(unexpectedCalls(page), 'requetes Supabase inattendues').toEqual([])
}
