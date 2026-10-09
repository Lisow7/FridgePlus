import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// B3 (audit d'intuitivité du 2026-10-02) : faire « retour » AVANT que la fiche
// recette ait fini de s'afficher fermait le panneau Recettes. L'écouteur
// « retour ferme la modale » du panneau, encore monté, recevait le popstate
// qui atterrissait sur SA PROPRE sentinelle. Garde : `use-close-on-back-button`
// ignore un popstate qui arrive sur sa propre entrée.
// Sans la garde : 6/6 rouges ; avec : 6/6 verts (mesuré le 2026-10-02).

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('un retour immédiat depuis une recette garde le panneau Recettes ouvert', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')

  const liste = page.locator('div.absolute.inset-0.overflow-y-auto').first()
  await liste.locator('button[aria-pressed]').nth(5).waitFor({ timeout: 15000 })
  await liste.locator('[data-recipe-id]').nth(2).click()
  await page.waitForURL(/\/recipe\//)
  await page.goBack()

  await expect(page).toHaveURL(/recettes=1/)
  await expect(page.getByLabel('Chercher une recette')).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page).toHaveURL(/recettes=1/)
})
