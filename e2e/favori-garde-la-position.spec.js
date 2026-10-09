import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Liker une recette ne doit pas renvoyer la liste en haut (signalé le 2026-10-02) :
// `filtered` change de référence à chaque like, et le panneau remettait le
// scroll à 0. Contre-épreuve : changer d'onglet, lui, remonte toujours la liste.

test('liker une recette garde la position de la liste', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')

  const liste = page.locator('div.absolute.inset-0.overflow-y-auto').first()
  await liste.waitFor()
  const coeurs = liste.locator('button[aria-pressed]')
  await coeurs.nth(20).waitFor({ timeout: 10000 })

  await liste.evaluate(el => { el.scrollTop = 1500 })
  await expect.poll(() => liste.evaluate(el => el.scrollTop)).toBeGreaterThan(1000)
  const avant = await liste.evaluate(el => el.scrollTop)

  // Premier cœur visible dans la zone défilée
  const zone = await liste.boundingBox()
  let cible = null
  for (let i = 0; i < await coeurs.count(); i++) {
    const b = await coeurs.nth(i).boundingBox()
    if (b && b.y > zone.y + 50 && b.y < zone.y + zone.height - 50) { cible = coeurs.nth(i); break }
  }
  expect(cible).not.toBeNull()
  await cible.click()
  await expect(cible).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(300)
  expect(await liste.evaluate(el => el.scrollTop)).toBe(avant)

  await page.getByRole('button', { name: /^Favoris/i }).first().click()
  await expect.poll(() => liste.evaluate(el => el.scrollTop)).toBe(0)
})
