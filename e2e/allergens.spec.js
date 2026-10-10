import { test, expect } from '@playwright/test'

// Ce fichier portait aussi « badges allergènes visibles sur au moins une carte »
// (v3.6.3). Les badges sont dérivés des allergènes des ingrédients servis par
// la base ; le socle e2e (`installSupabaseMocks`) sert des tables vides, donc
// aucune carte n'en porte ici — et le test se sautait lui-même, vert quoi qu'il
// arrive (audit du 2026-10-04, ARCH-17 (3)). La dérivation est prouvée par
// `src/test/unit/card-allergens.test.js` ; le rendu des puces par
// `recipe-card-allergenes.test.jsx`. Le test e2e est retiré.

test('le sélecteur de langue n\'affiche pas le japonais (v3.3.18)', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Ouvrir le menu déroulant des paramètres (ou langues)
  // L'app affiche un sélecteur de langue dans le header — l'icône varie.
  // On vérifie juste que '日本語' n'apparaît pas dans le DOM (tous menus inclus).
  const japanese = page.locator('text=日本語')
  await expect(japanese).toHaveCount(0)
})
