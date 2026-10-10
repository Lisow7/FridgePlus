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

test('un invité : la voix et la photo du ticket attendront, et le bandeau part au retour du réseau', async ({ page, context }) => {
  await page.goto('/FridgePlus/')
  await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
  // L'app entièrement chargée (ses morceaux à la demande compris), comme après
  // une première visite où le service worker les garde : sinon couper le réseau
  // interromprait un chargement en cours, ce que ce test ne mesure pas.
  await page.waitForLoadState('networkidle')
  const bandeau = page.getByRole('status').filter({ hasText: 'Pas de réseau.' })
  await expect(bandeau).toHaveCount(0)

  await context.setOffline(true)
  await expect(bandeau).toContainText('La voix et la photo du ticket attendront son retour.')

  await context.setOffline(false)
  await expect(bandeau).toHaveCount(0)
  // … parce que le réseau est revenu, pas parce que l'app serait tombée.
  await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
})

test('un compte : ce qu’il change ne sera pas enregistré tant que le réseau n’est pas revenu', async ({ page, context }) => {
  await signedInAs(page, { profile: { language: 'fr' } })
  await page.goto('/FridgePlus/')
  await expect(page.getByRole('button', { name: 'Ouvrir le frigo' })).toBeVisible()
  // L'app entièrement chargée (ses morceaux à la demande compris), comme après
  // une première visite où le service worker les garde : sinon couper le réseau
  // interromprait un chargement en cours, ce que ce test ne mesure pas.
  await page.waitForLoadState('networkidle')

  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: 'Pas de réseau.' }))
    .toContainText('Ce que tu changes ne sera pas enregistré tant qu’il n’est pas revenu.')
  await context.setOffline(false)
})
