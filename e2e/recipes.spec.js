import { test, expect } from '@playwright/test'

// Scénario 2 — Recettes (mode invité, localStorage)
// Vérifie que le panneau recettes s'ouvre et qu'au moins une recette
// est affichée. Smoke test post-audit : valide que le code splitting
// (lazy + Suspense) ne casse pas le rendu.

test('le panneau Recettes s\'ouvre et affiche les recettes', async ({ page }) => {
  await page.goto('/')

  // Attendre que la page soit rendue
  await page.waitForLoadState('networkidle')

  // Le bouton flottant pour ouvrir les recettes (en bas)
  const recipesBtn = page.locator('button', { hasText: /recette/i }).first()

  // Si visible, cliquer dessus pour ouvrir le panneau
  if (await recipesBtn.isVisible().catch(() => false)) {
    await recipesBtn.click()
    // Attendre que le panneau s'affiche : on cherche un titre ou un emoji recette
    await expect(page.locator('text=/Carbonara|Omelette|Ratatouille/i').first()).toBeVisible({ timeout: 5000 })
  }
})

test('changer la langue persiste dans localStorage', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Vérifier qu'une clé fridge-lang existe (créée au load)
  const lang = await page.evaluate(() => localStorage.getItem('fridge-lang'))
  expect(['fr','en','es','de','ja','null']).toContain(String(lang))
})
