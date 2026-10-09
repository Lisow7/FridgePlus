import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit d'intuitivité du 2026-10-02 : Échap dans le tiroir des filtres fermait
// AUSSI le panneau Recettes. Les deux écoutaient `window` en dehors de la pile
// des pièges de focus (`activeTraps`), faite pour que seul le dessus réagisse.

test('Échap ferme le tiroir des filtres, puis seulement ensuite le panneau', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')

  const recherche = page.getByPlaceholder('Chercher une recette…')
  await expect(recherche).toBeVisible()
  await page.getByRole('button', { name: /Filtres/ }).first().click()
  const tiroir = page.getByRole('dialog', { name: /Filtres/ })
  await expect(tiroir).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(tiroir).toBeHidden()
  await expect(recherche).toBeVisible()
  await expect(page).toHaveURL(/recettes=1/)

  await page.keyboard.press('Escape')
  await expect(recherche).toBeHidden()
})
