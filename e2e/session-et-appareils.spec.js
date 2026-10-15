import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, assertNoUnmockedCalls, skipOnboardingOverlays, signedInAs, fakeJwt,
  mockAuthUser, mockActivityLogs,
} from './support/supabase-mock.js'

// Décision du 2026-10-08 — la session du compte :
//   · « Se déconnecter » = cet appareil ; « Déconnecter tous mes
//     appareils » dans Compte & sécurité — toutes les sessions, et les
//     notifications de tous les appareils du compte. Jusque-là, le menu
//     déconnectait tous les appareils, sans le dire ;
//   · une session fermée sans geste d'ici le dit dans le
//     bandeau du haut, avec « Me reconnecter ». Jusque-là : retour muet en invité.
//
// La base est simulée (un seul projet Supabase, celui de production).

const ID = '00000000-0000-0000-0000-000000000002'
const BANDEAU = 'Ta session a expiré. Reconnecte-toi pour retrouver ton frigo.'

async function compterLesSorties(page) {
  const sorties = []
  await page.route('**/auth/v1/logout**', (route) => {
    sorties.push(route.request().url())
    return route.fulfill({ status: 204, body: '' })
  })
  return sorties
}

test.describe('Se déconnecter', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
    await signedInAs(page, { profile: { language: 'fr' } })
  })

  test('le menu du compte ferme la session de CET appareil seulement, sans bandeau', async ({ page }) => {
    const sorties = await compterLesSorties(page)
    await page.goto('/FridgePlus/')
    await page.getByRole('button', { name: 'Menu utilisateur' }).click()
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
    // Le détachement des notifications est borné à 3 s avant la fermeture.
    await expect.poll(() => sorties.length, { timeout: 10_000 }).toBe(1)
    expect(sorties[0], 'cet appareil').toMatch(/scope=local/)
    await expect(page.getByRole('alert').filter({ hasText: BANDEAU })).toHaveCount(0)
    assertNoUnmockedCalls(page)
  })

  test('« Déconnecter tous mes appareils » : toutes les sessions, après les notifications de tous les appareils', async ({ page }) => {
    const sorties = await compterLesSorties(page)
    const notifications = []
    await page.route('**/rest/v1/push_subscriptions**', (route) => {
      const req = route.request()
      notifications.push(`${req.method()} ${new URL(req.url()).search}`)
      return route.fulfill({ status: 204, body: '' })
    })
    // La page Compte trace sa consultation au journal RGPD (getUser, puis une ligne).
    await mockAuthUser(page)
    await mockActivityLogs(page)
    await page.goto('/FridgePlus/profile/compte')
    await page.getByRole('button', { name: 'Déconnecter tous mes appareils' }).click()
    await expect.poll(() => sorties.length, { timeout: 10_000 }).toBe(1)
    expect(sorties[0], 'toutes les sessions').toMatch(/scope=global/)
    expect(notifications).toEqual([`DELETE ?user_id=eq.${ID}`])
    // La page réservée rend la main à l'accueil, sans le bandeau d'une session perdue.
    await expect(page).toHaveURL(/\/FridgePlus\/?$/)
    await expect(page.getByRole('alert').filter({ hasText: BANDEAU })).toHaveCount(0)
    assertNoUnmockedCalls(page)
  })
})

test.describe('Une session qui se perd', () => {
  test('refusée au retour sur l’app : le bandeau du haut le dit, « Me reconnecter » mène à la connexion', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
    // Une visite précédente, connectée : la session gardée sur l'appareil (expirée)
    // et le témoin de l'app. Entre-temps, la session a été fermée depuis un autre
    // appareil : le serveur refuse de la renouveler.
    const session = {
      access_token: fakeJwt(ID, 'a@b.co'),
      refresh_token: 'refresh-revoque',
      expires_at: Math.floor(Date.now() / 1000) - 60,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: ID, email: 'a@b.co', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: { provider: 'email' } },
    }
    await page.addInitScript((valeur) => {
      window.localStorage.setItem('fridge-session-ouverte', '1')
      const brut = JSON.stringify(valeur)
      let retiree = false
      const lire = window.localStorage.getItem.bind(window.localStorage)
      const retirer = window.localStorage.removeItem.bind(window.localStorage)
      window.localStorage.getItem = (cle) => (typeof cle === 'string' && cle.endsWith('-auth-token') && !retiree) ? brut : lire(cle)
      window.localStorage.removeItem = (cle) => {
        if (typeof cle === 'string' && cle.endsWith('-auth-token')) retiree = true
        return retirer(cle)
      }
    }, session)
    await page.route('**/auth/v1/token**', (route) => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }),
    }))

    await page.goto('/FridgePlus/')
    const bandeau = page.getByRole('alert').filter({ hasText: BANDEAU })
    await expect(bandeau).toBeVisible()
    await bandeau.getByRole('button', { name: 'Me reconnecter' }).click()
    await expect(page).toHaveURL(/\/FridgePlus\/login$/)
    await expect(bandeau).toHaveCount(0)
  })

  test('un visiteur qui ne s’est jamais connecté : pas de bandeau (témoin)', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
    await page.goto('/FridgePlus/')
    await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: BANDEAU })).toHaveCount(0)
    assertNoUnmockedCalls(page)
  })
})
