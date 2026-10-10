import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays, installSupabaseMocks, signedInAs } from './support/supabase-mock.js'

// Mesuré le 2026-10-03 : sur mobile, « J'ai cuisiné cette recette » était à
// 1 600 px du haut d'un écran de 844 — au bout de la fiche, après les étapes.
// L'usage réel montrait 35 visiteurs qui ouvrent une recette pour 3 qui la
// cuisinent. Le bouton reste désormais visible sous la zone qui défile.

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('mobile : « J’ai cuisiné » est visible dès l’ouverture de la fiche, sans défiler', async ({ page }) => {
  // Données STATIQUES (Supabase intercepté) : même environnement en local et
  // en CI — sans ça, le test passait en local (vraies recettes, avec étapes)
  // et échouait en CI (catalogue statique, sans étapes). Connecté : le pied
  // existe même pour une recette sans étapes.
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await signedInAs(page)
  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-recipe-id]').first().click()
  await page.waitForURL(/\/recipe\//)

  const cuisine = page.getByRole('button', { name: /J['’]ai cuisiné/ })
  await expect(cuisine).toBeVisible()
  const cadre = await cuisine.boundingBox()
  expect(cadre.y + cadre.height, 'le bouton doit être dans l’écran sans défiler').toBeLessThanOrEqual(844)
  await expect(cuisine).toBeInViewport()
})
