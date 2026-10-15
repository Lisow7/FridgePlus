import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// Décision du 2026-10-08 : quand le réseau tombe, un bandeau le dit tant qu'il
// manque, et part seul à son retour. Le réseau du navigateur est vraiment coupé
// (Playwright), pas seulement simulé dans la page.
//
// La base est simulée (un seul projet Supabase, celui de production).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
})

// Le drapeau de la photo du ticket coupe vraiment (décision du 2026-10-08) : le
// bandeau d'un invité ne promet la photo que si le drapeau est allumé. Le socle
// sert une table `feature_flags` vide — drapeau absent, donc éteint.
const photoDuTicketAllumee = (page) => page.route('**/rest/v1/feature_flags*', (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify([{ key: 'receipt_scan', enabled: true, label: 'Scan de ticket de caisse', description: '' }]),
}))

async function accueilChargePuisHorsLigne(page, context) {
  await page.goto('/FridgePlus/')
  await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
  // L'app entièrement chargée (ses morceaux à la demande compris), comme après
  // une première visite où le service worker les garde : sinon couper le réseau
  // interromprait un chargement en cours, ce que ce test ne mesure pas.
  await page.waitForLoadState('networkidle')
  const bandeau = page.getByRole('status').filter({ hasText: 'Pas de réseau.' })
  await expect(bandeau).toHaveCount(0)

  await context.setOffline(true)
  return bandeau
}

test('un invité, photo du ticket éteinte : l’ajout à la voix reviendra, et le bandeau part au retour du réseau', async ({ page, context }) => {
  const bandeau = await accueilChargePuisHorsLigne(page, context)
  await expect(bandeau).toContainText('L’ajout à la voix reviendra avec la connexion.')
  await expect(bandeau).not.toContainText('photo')

  await context.setOffline(false)
  await expect(bandeau).toHaveCount(0)
  // … parce que le réseau est revenu, pas parce que l'app serait tombée.
  await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
})

test('un invité, photo du ticket allumée : l’ajout à la voix et la photo reviendront', async ({ page, context }) => {
  await photoDuTicketAllumee(page)
  const bandeau = await accueilChargePuisHorsLigne(page, context)
  await expect(bandeau).toContainText('L’ajout à la voix et la photo du ticket reviendront avec la connexion.')
  await context.setOffline(false)
})

test('un compte : ses modifications ne peuvent pas être enregistrées pour l’instant', async ({ page, context }) => {
  await signedInAs(page, { profile: { language: 'fr' } })
  await page.goto('/FridgePlus/')
  await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
  // L'app entièrement chargée (ses morceaux à la demande compris), comme après
  // une première visite où le service worker les garde : sinon couper le réseau
  // interromprait un chargement en cours, ce que ce test ne mesure pas.
  await page.waitForLoadState('networkidle')

  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: 'Pas de réseau.' }))
    .toContainText('Tes modifications ne peuvent pas être enregistrées pour l’instant.')
  await context.setOffline(false)
})
