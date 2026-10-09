import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Décision du 2026-10-06, choix d'Antoine (« emoji = sur_le_site ») : le
// navigateur demandait chaque emoji à api.iconify.design ou à cdn.jsdelivr.net
// — et leur donnait l'adresse IP du visiteur, avant tout choix de cookies.
// Prouvé sur un vrai parcours : aucune requête vers eux, et les images
// viennent du site.

test('l’accueil et les recettes affichent leurs emoji sans contacter Iconify ni jsDelivr', async ({ page }) => {
  const tiers = []
  const locales = []
  page.on('request', (r) => {
    const u = r.url()
    if (/api\.iconify\.design|cdn\.jsdelivr\.net/.test(u)) tiers.push(u)
    if (/\/emoji\/(fluent|twemoji)\//.test(u)) locales.push(u)
  })
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.goto('/FridgePlus/?recettes=1')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-recipe-id]').first().waitFor()
  await page.waitForTimeout(500)

  expect(tiers, tiers.join('\n')).toEqual([])
  expect(locales.length, 'des emoji sont bien demandés… au site').toBeGreaterThan(0)
  const casses = await page.evaluate(() => [...document.querySelectorAll('img[src*="/emoji/"]')]
    .filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')))
  expect(casses, 'aucune image d’emoji cassée').toEqual([])
})
