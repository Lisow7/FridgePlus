import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, assertNoUnmockedCalls, unexpectedCalls,
  skipOnboardingOverlays, signedInAs,
  mockAuthUser, mockReauth, mockActivityLogs, activityLogRows,
  mockDeleteAccount, deleteAccountCalls,
  mockRestoreAccount, restoreAccountCalls, profileWrites,
} from './support/supabase-mock.js'

// Suppression et restauration de compte — §6 (P1) point 2 de la note d'audit.
//
// Comme l'etape 1 (signup-funnel.spec.js), ces tests couvrent les PARCOURS
// D'INTERFACE et non l'integration backend : les edge functions sont mockees.
//
// Spec : la conception « e2e-suppression-restauration-compte » du 2026-08-07

test.describe('Garde-fou du socle', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
  })

  // Sans ce garde-fou, le test « aucune suppression sans re-auth » passerait
  // MEME si la protection n'existait pas : rien ne compterait l'appel parti.
  // Il vaut aussi comme garantie de securite — en local avec un .env.local de
  // production, un appel d'edge function non mocke partirait pour de vrai.
  test('un appel d\'edge function non mocke est signale', async ({ page }) => {
    await page.goto('/FridgePlus/?restore-account=TOK-NON-MOCKE')
    await expect
      .poll(() => unexpectedCalls(page), { message: 'l\'appel edge function doit etre vu' })
      .toContain('POST functions/restore-account')
  })
})

const UID = '00000000-0000-0000-0000-000000000002'
// Conforme a la policy partagee (password-policy.js) : longueur, minuscule,
// majuscule, chiffre, caractere special.
const VALID_PWD = 'Fridge+2026!x'

/**
 * Ouvre le dialogue de suppression et renvoie son panneau.
 *
 * DEUX PIEGES, mesures le 2026-08-07 :
 *  1. La section est repliee (`collapsible` + `defaultOpen={false}`) : avant le
 *     clic sur l'en-tete, le bouton d'ouverture n'existe PAS dans le DOM
 *     (getByRole en compte 0) et la recherche part en timeout sur un message
 *     qui ne designe pas la cause.
 *  2. « Supprimer mon compte » (t.dangerBtn) nomme A LA FOIS le bouton de la
 *     section et le submit du dialogue : le compte passe de 1 a 2 des que le
 *     dialogue est ouvert. Le submit doit donc etre cherche dans le panneau,
 *     sinon Playwright echoue en violation du mode strict.
 */
async function openDeleteDialog(page) {
  await page.getByRole('button', { name: /Zone de danger/i }).click()
  await page.getByRole('button', { name: /Supprimer mon compte/i }).click()
  const panel = page.locator('.fp-modal-panel')
  await expect(panel).toBeVisible()
  return panel
}

test.describe('Suppression de compte', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
    await signedInAs(page, { username: 'Foodie_42' })
    // Sans ce mock, `logAuditAction()` s'arrete sur son `auth.getUser()` et
    // AUCUN insert activity_logs ne part : on testerait le parcours RGPD sur
    // une application dont la journalisation est eteinte.
    await mockAuthUser(page)
    await mockActivityLogs(page)
  })

  test('un mot de passe incorrect n\'entraine aucune suppression', async ({ page }) => {
    // 400 invalid_grant explicite, et non un abandon de requete : l'abandon
    // produit le meme message a l'ecran mais simule une PANNE RESEAU, pas un
    // refus d'authentification.
    await mockReauth(page, { ok: false })
    await mockDeleteAccount(page)
    await page.goto('/FridgePlus/profile/compte')

    const panel = await openDeleteDialog(page)
    await panel.locator('input[type="password"]').fill('mauvais-mot-de-passe')
    await panel.getByRole('button', { name: /Supprimer mon compte/i }).click()

    await expect(page.getByText(/Mot de passe incorrect/i)).toBeVisible()
    // Denonce en PREMIER un appel parti sans mock — significatif seulement
    // depuis l'ajout de l'attrape-tout functions/v1 : avant, aucun appel
    // d'edge function n'etait compte, et ce test passait donc meme si la
    // protection n'existait pas.
    assertNoUnmockedCalls(page)
    // Filet complementaire : si l'appel partait malgre le refus, il serait
    // capture ici plutot que signale comme inattendu.
    expect(deleteAccountCalls(page), 'aucune suppression sans re-auth').toEqual([])
    await expect(page).toHaveURL(/\/profile\/compte$/)
  })

  test('un mot de passe correct declenche la suppression, une seule fois', async ({ page }) => {
    await mockReauth(page, { ok: true })
    await mockDeleteAccount(page)
    // La suppression ferme VRAIMENT la session (portée « global », BDD-04).
    const deconnexions = []
    await page.route('**/auth/v1/logout**', (route) => { deconnexions.push(route.request().url()); return route.fulfill({ status: 204, body: '' }) })
    await page.goto('/FridgePlus/profile/compte')

    const panel = await openDeleteDialog(page)
    await panel.locator('input[type="password"]').fill(VALID_PWD)
    await panel.getByRole('button', { name: /Supprimer mon compte/i }).click()

    // ORDRE DES ASSERTIONS — etabli par la mutation du 2026-08-07, pas par
    // gout : en placant `assertNoUnmockedCalls` en dernier, le retrait du mock
    // faisait echouer le test sur la redirection absente, un symptome qui ne
    // designe PAS sa cause. On attend donc qu'un appel soit parti (mocke ou
    // non), puis on denonce l'appel non mocke AVANT tout le reste.
    await expect
      .poll(() => deleteAccountCalls(page).length + unexpectedCalls(page).length,
        { message: 'la suppression doit avoir ete tentee' })
      .toBeGreaterThan(0)
    assertNoUnmockedCalls(page)

    // « Compte désactivé » (CPT-04) : il n'existait AUCUN message de succès,
    // la redirection était le seul signal. Puis la vraie déconnexion.
    await expect(page.getByRole('heading', { name: 'Compte désactivé' })).toBeVisible()
    await expect(page.getByText(/reconnecte-toi avant cette date/)).toBeVisible()
    await expect.poll(() => deconnexions.length, { message: 'la session doit être fermée' }).toBe(1)
    expect(deconnexions[0], 'toutes les sessions du compte').toMatch(/scope=global/)
    await page.getByRole('button', { name: 'Retour à l’accueil' }).click()
    await expect(page).toHaveURL(/\/FridgePlus\/?$/)

    // Le NOMBRE compte autant que le contenu : c'est un appel sans retour
    // possible. Leçon de #958 — une assertion de contenu sans assertion de
    // cardinalite laisse un doublon invisible.
    const calls = deleteAccountCalls(page)
    expect(calls, 'exactement une suppression').toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].authorization, 'jeton de session transmis').toMatch(/^Bearer .+/)
    expect(calls[0].body).toEqual({ lang: 'fr' })

    // Trace RGPD : filtrage par action (cf. avertissement d'activityLogRows).
    const soft = activityLogRows(page).filter((row) => row.action === 'account_soft_deleted')
    expect(soft, 'une seule trace de suppression').toHaveLength(1)
    expect(soft[0].target_type).toBe('user')
    expect(soft[0].user_id).toBe(UID)
  })

  test('un echec serveur affiche une erreur sans deconnecter', async ({ page }) => {
    await mockReauth(page, { ok: true })
    await mockDeleteAccount(page, { status: 500 })
    await page.goto('/FridgePlus/profile/compte')

    const panel = await openDeleteDialog(page)
    await panel.locator('input[type="password"]').fill(VALID_PWD)
    await panel.getByRole('button', { name: /Supprimer mon compte/i }).click()

    await expect(page.getByText(/Une erreur est survenue/i)).toBeVisible()
    // La suppression a bien ete TENTEE...
    expect(deleteAccountCalls(page)).toHaveLength(1)
    // ...mais un echec ne doit pas produire de deconnexion fantome.
    await expect(page).toHaveURL(/\/profile\/compte$/)
    assertNoUnmockedCalls(page)
  })
})

// À la reconnexion pendant les 30 jours, le choix est EXPLICITE (BDD-04) :
// avant, n'importe quel événement d'authentification annulait la suppression
// en silence, et la purge à 30 jours ne trouvait plus rien.
test.describe('Reconnexion d’un compte en cours de suppression', () => {
  const SUPPRIME_LE = new Date(Date.now() - 2 * 864e5).toISOString()

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
    await signedInAs(page, { username: 'Foodie_42', profile: { deleted_at: SUPPRIME_LE } })
  })

  test('l’écran du choix, et AUCUNE annulation silencieuse', async ({ page }) => {
    await page.goto('/FridgePlus/')
    await expect(page.getByRole('heading', { name: 'Ton compte est en cours de suppression' })).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)
    expect(profileWrites(page).filter((w) => 'deleted_at' in w), 'aucune annulation sans geste').toEqual([])
    await expect(page.getByRole('button', { name: 'Ouvrir le frigo' }).filter({ visible: true })).toHaveCount(0)
  })

  test('« Annuler la suppression » : l’annulation est écrite, l’application revient', async ({ page }) => {
    await page.goto('/FridgePlus/')
    await page.getByRole('button', { name: 'Annuler la suppression' }).click()
    await expect.poll(() => profileWrites(page).filter((w) => 'deleted_at' in w)).toEqual([{ deleted_at: null, restore_token: null }])
    await expect(page.getByRole('heading', { name: 'Ton compte est en cours de suppression' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ouvrir le frigo' }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 })
  })

  test('« Me déconnecter » : rien n’est annulé', async ({ page }) => {
    await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }))
    await page.goto('/FridgePlus/')
    await page.getByRole('button', { name: 'Me déconnecter' }).click()
    await expect(page.getByRole('heading', { name: 'Ton compte est en cours de suppression' })).toHaveCount(0, { timeout: 15000 })
    expect(profileWrites(page).filter((w) => 'deleted_at' in w)).toEqual([])
  })
})

// Parcours INVITE, et non authentifie : la suppression a ferme toutes les
// sessions, donc la personne qui clique le lien recu par e-mail n'est pas
// connectee. C'est l'etat reel du parcours.
test.describe('Restauration par lien e-mail', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
  })

  test('un lien valide restaure le compte et nettoie l\'URL', async ({ page }) => {
    await mockRestoreAccount(page, { outcome: 'ok' })
    await page.goto('/FridgePlus/?restore-account=TOK-123')

    await expect(page.getByText(/Compte restaur.* Tu peux te reconnecter/i)).toBeVisible()
    expect(restoreAccountCalls(page)).toEqual(['TOK-123'])
    // Le hook nettoie l'URL AVANT l'appel : sans cela, un rechargement
    // relancerait indefiniment la restauration.
    await expect(page).not.toHaveURL(/restore-account/)
    assertNoUnmockedCalls(page)
  })

  test('un lien expire est signale comme tel', async ({ page }) => {
    await mockRestoreAccount(page, { outcome: 'expired' })
    await page.goto('/FridgePlus/?restore-account=TOK-EXPIRE')

    await expect(page.getByText(/lien a expir.*30 jours/i)).toBeVisible()
    assertNoUnmockedCalls(page)
  })

  test('un lien deja utilise est signale comme invalide', async ({ page }) => {
    await mockRestoreAccount(page, { outcome: 'invalid_token' })
    await page.goto('/FridgePlus/?restore-account=TOK-DEJA-UTILISE')

    await expect(page.getByText(/Lien invalide ou d.*utilis/i)).toBeVisible()
    assertNoUnmockedCalls(page)
  })
})
