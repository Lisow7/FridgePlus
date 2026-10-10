import { test, expect } from '@playwright/test'
import { BOOT_TABLES, installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// Session et profil (audit du 2026-10-04, PREM-06 et CPT-12).
//
// Le profil arrive APRÈS que l'app se dit « chargée » : pendant ce temps un
// abonné voyait le verrou « Panier de courses — Bientôt disponible » à chaque
// ouverture de /cart. Et si le profil ne charge pas du tout, la personne
// restait « connectée sans profil » sans un mot. Ici, la base est simulée :
// un profil qui tarde (1,5 s), puis un profil qui ne vient pas.

const UID = '00000000-0000-0000-0000-000000000002'

async function connecter(page, repondreAuProfil) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('fridge-lang', 'fr') })
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.route('**/rest/v1/**', (route) => {
    const methode = route.request().method()
    const table = new URL(route.request().url()).pathname.split('/rest/v1/')[1]?.split('?')[0] ?? ''
    if (BOOT_TABLES.includes(table)) return route.fallback()
    if (methode === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    if (methode === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' })
    return route.fallback()
  })
  await signedInAs(page, { id: UID })
  // Posée APRÈS signedInAs : c'est elle qui répond désormais sur `profiles`.
  await page.route('**/rest/v1/profiles**', repondreAuProfil)
}

test('un abonné dont le profil tarde ne voit jamais le verrou du panier', async ({ page }) => {
  await connecter(page, async (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 204, body: '' })
    await new Promise((r) => setTimeout(r, 1500))
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: UID, username: 'Foodie_42', subscription_status: 'comped' }),
    })
  })
  // Un témoin dans la page : le verrou est-il apparu, ne serait-ce qu'un instant ?
  await page.addInitScript(() => {
    window.__verrouVu = false
    new MutationObserver(() => {
      if (document.body?.textContent.includes('Bientôt disponible')) window.__verrouVu = true
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  })

  await page.goto('/FridgePlus/cart')
  await expect(page.getByRole('button', { name: 'Ajouter un article' })).toBeVisible({ timeout: 15000 })
  expect(await page.evaluate(() => window.__verrouVu), 'le verrou « Bientôt disponible » est apparu avant le profil').toBe(false)
})

test('un profil qui ne charge pas : l’app le dit, et « Réessayer » relit', async ({ page }) => {
  let laBaseRepond = false
  let lectures = 0
  await connecter(page, (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 204, body: '' })
    lectures += 1
    if (!laBaseRepond) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"panne simulée"}' })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: UID, username: 'Foodie_42' }),
    })
  })

  await page.goto('/FridgePlus/')
  const alerte = page.getByRole('alert').filter({ hasText: /profil/i })
  await expect(alerte).toBeVisible({ timeout: 15000 })
  const lecturesAvant = lectures
  expect(lecturesAvant).toBeGreaterThanOrEqual(4)

  laBaseRepond = true
  await alerte.getByRole('button', { name: 'Réessayer' }).click()
  await expect(alerte).toBeHidden()
  // La relecture part 200 ms après le clic (premier délai du filet de sécurité).
  await expect.poll(() => lectures).toBeGreaterThan(lecturesAvant)
  await expect(alerte).toBeHidden()
})
