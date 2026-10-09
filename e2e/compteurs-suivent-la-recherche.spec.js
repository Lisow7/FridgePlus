import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit d'intuitivité du 2026-10-02 : pendant une recherche, les onglets
// gardaient leurs nombres globaux — « Toutes 515 » à côté de « Aucune
// recette ». Chaque onglet compte désormais ce qu'il montrerait avec la
// recherche et les filtres en cours (compteurs à facettes).

test('les compteurs des onglets suivent la recherche', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.addInitScript(() => localStorage.setItem('fridge-stock', JSON.stringify(['fr-beurre-doux', 'fr-oeufs-plein-air'])))
  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')

  const toutes = page.getByRole('button', { name: /^\s*\d+\s*Toutes/ }).first()
  await expect(toutes).toBeVisible()
  const avant = Number((await toutes.innerText()).match(/\d+/)[0])
  expect(avant).toBeGreaterThan(10)

  await page.getByLabel('Chercher une recette').fill('zzzzqx')
  await expect(toutes).toHaveText(/^\s*0\s*Toutes/)

  await page.getByLabel('Chercher une recette').fill('omelette')
  const apres = Number((await toutes.innerText()).match(/\d+/)[0])
  expect(apres).toBeGreaterThan(0)
  expect(apres).toBeLessThan(avant)
})
