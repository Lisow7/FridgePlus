import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays, installSupabaseMocks } from './support/supabase-mock.js'

// Audit du 2026-10-04. « Imprimer la fiche » ouvrait une fenêtre `blob:` et
// comptait sur un `<script>` en ligne pour lancer l'impression : la CSP de
// production le refusait, donc rien ne s'imprimait ; la fiche n'avait pas de
// nom ; et un champ non échappé y devenait du code (SEC-01, SEC-04).
//
// La fiche est désormais un composant React rendu dans une racine d'impression,
// et c'est l'app qui appelle `window.print()`. Ce test joue le geste réel : les
// tests unitaires prouvent chaque pièce, celui-ci prouve qu'elles sont
// BRANCHÉES ensemble dans un vrai navigateur.
test('« Imprimer la fiche » imprime la recette affichée, sans ouvrir de fenêtre', async ({ page, context }) => {
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  // `window.print()` ouvrirait la boîte de dialogue du système et bloquerait le
  // test : on note ce qui se trouve dans la racine d'impression à cet instant.
  await page.addInitScript(() => {
    window.__impressions = []
    window.print = () => {
      window.__impressions.push(document.querySelector('.fp-print-root')?.textContent ?? null)
    }
  })

  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-recipe-id]').first().click()
  await page.waitForURL(/\/recipe\//)
  // Le nom affiché, lu dans le titre de l'onglet (« Pasta Carbonara : la recette —
  // Fridge+ », décision du 2026-10-08 ; espace insécable avant le deux-points).
  // Pas dans le premier <h1> : l'accueil reste monté sous la fiche et porte le
  // sien (« Frigo & Garde-manger »), que `.first()` attrape selon le moment.
  await expect(page).toHaveTitle(/.+\u00A0: la recette — Fridge\+$/)
  const nom = (await page.title()).replace(/\u00A0: la recette — Fridge\+$/, '')

  await page.getByRole('button', { name: 'Partager la recette' }).click()
  await page.getByRole('button', { name: 'Imprimer la fiche' }).click()

  const impressions = await page.evaluate(() => window.__impressions)
  expect(impressions, 'un seul appel à window.print()').toHaveLength(1)
  expect(impressions[0], 'la fiche porte le nom affiché').toContain(nom)
  expect(impressions[0]).toContain('Ingrédients')
  expect(impressions[0]).toContain('Préparation')
  expect(impressions[0]).not.toContain('min min')
  expect(context.pages(), 'aucune fenêtre ouverte').toHaveLength(1)

  // À l'impression, seule la fiche est visible : l'application est masquée.
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.fp-print-sheet')).toBeVisible()
  await expect(page.locator('#root')).toBeHidden()

  // Fin d'impression : la racine disparaît et l'app redevient imprimable
  // (la page du panier partagé s'imprime elle-même).
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(page.locator('.fp-print-root')).toHaveCount(0)
  await expect(page.locator('#root')).toBeVisible()
})
