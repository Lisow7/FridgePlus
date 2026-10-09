import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays, signedInAs, fakeJwt, profileWrites } from './support/supabase-mock.js'

// La double authentification est demandée (audit du 2026-10-04, CPT-01 ;
// maquette validée par Antoine le 2026-10-05).
//
// Le vrai supabase-js, de bout en bout : une session au mot de passe seul (aal1)
// d'un compte qui a un facteur vérifié ouvre la porte « Vérification en 2
// étapes », et RIEN d'autre — pas même la lecture du frigo du compte. Le code
// accepté (la bibliothèque reçoit une session aal2 et émet
// MFA_CHALLENGE_VERIFIED) lève la porte.
//
// Le lien « mot de passe oublié » (PASSWORD_RECOVERY) n'est pas rejoué ici : en
// PKCE, il exige le vérificateur de code rangé par la demande de
// réinitialisation, sous une clé qui dépend du projet. Son chemin est prouvé
// dans `auth-mfa-requis.test.jsx`.

const ID = '00000000-0000-0000-0000-000000000002'
const EMAIL = 'a@b.co'
const FACTEUR = { id: 'facteur-1', factor_type: 'totp', status: 'verified', friendly_name: 'Fridge+ TOTP' }
const TITRE = { name: 'Vérification en 2 étapes' }

async function preparer(page, { factors = [FACTEUR], aal = 'aal1' } = {}) {
  await page.setViewportSize({ width: 390, height: 860 })
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await signedInAs(page, { id: ID, email: EMAIL, aal, factors })
  const lecturesDuCompte = []
  page.on('request', (r) => { if (/\/rest\/v1\/(user_stock|user_favorites|custom_recipes)/.test(r.url())) lecturesDuCompte.push(r.url()) })
  return lecturesDuCompte
}

const porte = (page) => page.getByRole('heading', TITRE)
const frigo = (page) => page.getByRole('button', { name: 'Ouvrir le frigo' }).filter({ visible: true }).first()

test('compte protégé, session au mot de passe seul : la porte, et rien d’autre — pas même la lecture du frigo', async ({ page }) => {
  test.setTimeout(60000)
  const lectures = await preparer(page)
  await page.goto('/FridgePlus/')
  await expect(porte(page)).toBeVisible({ timeout: 15000 })
  await expect(page.getByLabel('Code à 6 chiffres')).toBeFocused()
  await page.waitForTimeout(1500)
  await expect(frigo(page)).toHaveCount(0)
  expect(lectures).toEqual([])
  // Aucune écriture du compte non plus : la langue de l'appareil n'est pas
  // recopiée dans le profil (AccountSync est sous la porte).
  expect(profileWrites(page).filter((w) => 'language' in w)).toEqual([])
  await page.screenshot({ path: 'test-results/porte-double-authentification-390.png' })
})

test('code accepté : la porte se lève, l’application et le compte arrivent', async ({ page }) => {
  test.setTimeout(60000)
  const lectures = await preparer(page)
  await page.route('**/auth/v1/factors/facteur-1/challenge**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'defi-1', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 }),
  }))
  await page.route('**/auth/v1/factors/facteur-1/verify**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      access_token: fakeJwt(ID, EMAIL, 'aal2'), refresh_token: 'refresh-inerte-non-utilise', expires_in: 3600, token_type: 'bearer',
      user: { id: ID, email: EMAIL, aud: 'authenticated', role: 'authenticated', user_metadata: { username: 'Foodie_42' }, app_metadata: { provider: 'email' }, factors: [FACTEUR] },
    }),
  }))
  await page.goto('/FridgePlus/')
  await expect(porte(page)).toBeVisible({ timeout: 15000 })
  await page.getByLabel('Code à 6 chiffres').fill('123456')
  await page.getByRole('button', { name: 'Vérifier' }).click()
  await expect(porte(page)).toHaveCount(0, { timeout: 15000 })
  await expect(frigo(page)).toBeVisible({ timeout: 15000 })
  await expect.poll(() => lectures.length, { timeout: 15000 }).toBeGreaterThan(0)
  await expect.poll(() => profileWrites(page).some((w) => 'language' in w), { timeout: 15000 }).toBe(true)
})

test('code refusé : c’est dit, et la porte reste', async ({ page }) => {
  test.setTimeout(60000)
  await preparer(page)
  await page.route('**/auth/v1/factors/facteur-1/challenge**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'defi-1', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 }),
  }))
  await page.route('**/auth/v1/factors/facteur-1/verify**', (r) => r.fulfill({
    status: 422, contentType: 'application/json',
    body: JSON.stringify({ code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }),
  }))
  await page.goto('/FridgePlus/')
  await expect(porte(page)).toBeVisible({ timeout: 15000 })
  await page.getByLabel('Code à 6 chiffres').fill('000000')
  await page.getByRole('button', { name: 'Vérifier' }).click()
  await expect(page.getByRole('alert')).toContainText('Code incorrect', { timeout: 15000 })
  await expect(porte(page)).toBeVisible()
  await expect(frigo(page)).toHaveCount(0)
})

test('« Me déconnecter » : retour à l’accueil, sans compte', async ({ page }) => {
  test.setTimeout(60000)
  await preparer(page)
  await page.route('**/auth/v1/logout**', (r) => r.fulfill({ status: 204, body: '' }))
  await page.goto('/FridgePlus/')
  await expect(porte(page)).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Me déconnecter' }).click()
  await expect(porte(page)).toHaveCount(0, { timeout: 15000 })
  await expect(frigo(page)).toBeVisible({ timeout: 15000 })
})

test('compte sans double authentification : pas de porte (témoin)', async ({ page }) => {
  test.setTimeout(60000)
  await preparer(page, { factors: [] })
  await page.goto('/FridgePlus/')
  await expect(frigo(page)).toBeVisible({ timeout: 15000 })
  await expect(porte(page)).toHaveCount(0)
})
