import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'
import { verifierLesCibles } from './support/cibles-tactiles.js'

// WCAG 2.2 — 2.5.8 « Taille de la cible (minimum) », niveau AA : 24 × 24 px.
// Mesuré le 2026-10-02 (audit d'intuitivité) : la croix « Masquer » faisait
// 11 × 20, « Fermer » de l'inventaire 15 × 27, les ± portions 22 × 22.
// La mesure et son exception (les liens du pied de page) vivent dans
// `support/cibles-tactiles.js` ; les écrans d'un compte connecté sont dans
// `cibles-tactiles-connecte.spec.js` (audit du 2026-10-04, A11Y-13).

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('les cibles des écrans principaux font au moins 24 × 24 px', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.addInitScript(() => {
    localStorage.setItem('fridge-stock', JSON.stringify(['fr-beurre-doux', 'fr-oeufs-plein-air', 'gp-spaghetti']))
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await verifierLesCibles(page, 'Accueil')

  await page.getByRole('button', { name: 'Actions rapides' }).click()
  await page.getByRole('menuitem', { name: /Inventaire/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await verifierLesCibles(page, 'Inventaire')

  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')
  await verifierLesCibles(page, 'Panneau Recettes')

  await page.locator('[data-recipe-id]').first().click()
  await page.waitForURL(/\/recipe\//)
  await expect(page.getByRole('button', { name: 'Plus de portions' })).toBeVisible()
  await verifierLesCibles(page, 'Fiche recette')
})
