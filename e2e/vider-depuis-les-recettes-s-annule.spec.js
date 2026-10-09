import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04, UX-06 : deux portes vidaient le frigo. Celle du bouton
// orange laissait 10 secondes pour annuler ; le « Vider » du panneau des
// recettes, posé à côté des filtres, supprimait tout d'un coup. Les deux
// laissent désormais le temps de se raviser.

const stockLocal = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('fridge-stock') || '[]').length)

test('« Vider » dans le panneau des recettes : le frigo revient avec « Annuler »', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('stock-pose')) {
      localStorage.setItem('fridge-stock', JSON.stringify(['fr-beurre-doux', 'fr-oeufs-plein-air']))
      sessionStorage.setItem('stock-pose', '1')
    }
  })
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.goto('/FridgePlus/?recettes=1')
  await page.locator('[data-recipe-id]').first().waitFor()

  await page.getByRole('button', { name: 'Vider', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Vider le frigo ?' })
  await expect(confirmation).toContainText('10 secondes pour annuler')
  await confirmation.getByRole('button', { name: 'Vider', exact: true }).click()

  // Vidé à l'écran tout de suite…
  await expect(page.getByRole('button', { name: 'Vider', exact: true })).toHaveCount(0)
  // … et rattrapable pendant 10 secondes.
  await page.getByRole('button', { name: 'Annuler la suppression' }).click()
  await expect(page.getByRole('button', { name: 'Vider', exact: true })).toBeVisible()
  await expect.poll(() => stockLocal(page)).toBe(2)
})
