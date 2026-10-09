import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04, UX-07. Les coûts ne se voient qu'avec l'accès Premium
// (carte, onglet « Coût ») : pour un invité, le curseur « Budget maximum »
// disparaît du tiroir des filtres, et un lien partagé `?maxBud=1` (1 € la
// portion) ne retire aucune recette en silence — sans curseur à l'écran, il
// n'aurait pas pu le retirer.

async function nombreDeRecettes(page, adresse) {
  await page.goto(adresse)
  await page.locator('[data-recipe-id]').first().waitFor()
  const filtres = page.getByRole('button', { name: 'Filtres avancés' })
  // Aucun filtre actif compté : un budget masqué ne fait pas « Filtres (1) ».
  await expect(filtres).not.toContainText(/\d/)
  await filtres.click()
  const tiroir = page.getByRole('dialog', { name: 'Filtres' })
  await expect(tiroir.getByText('Nutrition', { exact: true })).toBeVisible()
  await expect(tiroir.getByText('Budget maximum')).toHaveCount(0)
  // Le repère est vu présent : « Calories maximum », dans la même section.
  await expect(tiroir.getByText('Calories maximum')).toBeVisible()
  const bouton = tiroir.getByRole('button', { name: /^\d+ recettes?$/ })
  return Number((await bouton.innerText()).match(/\d+/)[0])
}

test('invité : pas de curseur de budget, et un lien ?maxBud=1 ne retire aucune recette', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  const sans = await nombreDeRecettes(page, '/FridgePlus/?recettes=1')
  const avec = await nombreDeRecettes(page, '/FridgePlus/?recettes=1&maxBud=1')
  expect(sans).toBeGreaterThan(0)
  expect(avec).toBe(sans)
})
