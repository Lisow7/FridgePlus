import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// P1 — audit d'intuitivité du 2026-10-02 : remplir son frigo bac par bac
// coûtait 22 tapes pour 5 aliments ; la recherche était rangée sous
// « Vérifier » et ne comprenait ni « pâtes » ni « oeuf » (→ bœuf).

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('« Chercher un aliment » : champ prêt, « oeuf » donne des œufs, « pâtes » des pâtes', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Actions rapides' }).click()
  await page.getByRole('menuitem', { name: /Chercher un aliment/ }).or(page.getByRole('button', { name: /Chercher un aliment/ })).first().click()

  const champ = page.getByRole('textbox', { name: 'Rechercher un aliment…' })
  await expect(champ).toBeFocused()

  await champ.fill('oeuf')
  const dialogue = page.getByRole('dialog')
  const premiers = await dialogue.getByRole('button', { name: /^Ajouter / }).evaluateAll(bs => bs.slice(0, 5).map(b => b.getAttribute('aria-label')))
  expect(premiers.length).toBeGreaterThan(0)
  for (const nom of premiers) expect(nom).toMatch(/Œuf/i)
  await expect(dialogue.getByRole('button', { name: /Ajouter .*b(œ|oe)uf/i })).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText(/\d+ résultats?/)

  await champ.fill('pâtes')
  await expect(dialogue.getByRole('button', { name: 'Ajouter Spaghetti' })).toBeVisible()

  // Ajouter en un geste
  await dialogue.getByRole('button', { name: 'Ajouter Spaghetti' }).click()
  await expect(dialogue.getByRole('button', { name: /Retirer Spaghetti/ })).toBeVisible()
})
