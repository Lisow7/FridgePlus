import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04 (SEC-11) : `img-src` ne dit plus « https: » en entier,
// seulement le site, `data:`, `blob:` et le stockage du projet Supabase. Ce
// parcours sert les pages AVEC la directive `img-src` de vercel.json et relève
// chaque image refusée : une image tierce ajoutée un jour au code sans mise à
// jour de la politique fait tomber ce test, au lieu de disparaître en
// production.
//
// Seule `img-src` est appliquée : le serveur de dev de Vite insère un script en
// ligne (préambule React) que `script-src 'self'` refuserait. Les images du
// stockage sont écartées du relevé : en CI, faute de clé, elles pointent vers
// placeholder.supabase.co ; l'hôte du stockage est vérifié par
// src/test/unit/csp-policy.test.js.

const politique = JSON.parse(readFileSync('vercel.json', 'utf8'))
  .headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value
const imgSrc = politique.split(';').map((d) => d.trim()).find((d) => d.startsWith('img-src '))

test('accueil, recette et communauté : aucune image refusée par img-src', async ({ page }) => {
  expect(imgSrc, 'img-src présent dans vercel.json').toBeTruthy()
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.addInitScript(() => {
    window.__refus = []
    document.addEventListener('securitypolicyviolation', (e) => window.__refus.push(`${e.effectiveDirective} ${e.blockedURI}`))
  })
  await page.route('**/FridgePlus/**', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback()
    const reponse = await route.fetch()
    return route.fulfill({ response: reponse, headers: { ...reponse.headers(), 'content-security-policy': imgSrc } })
  })

  const refusees = async () => (await page.evaluate(() => window.__refus))
    .filter((r) => !/\.supabase\.co\/storage\//.test(r))

  await page.goto('/FridgePlus/?recettes=1')
  await page.locator('[data-recipe-id]').first().waitFor()
  await page.waitForLoadState('networkidle')
  expect(await refusees(), 'accueil et panneau Recettes').toEqual([])
  expect(await page.locator('img[src*="/emoji/"]').count(), 'des images sont bien affichées').toBeGreaterThan(0)

  await page.goto('/FridgePlus/recipe/affogato')
  await page.waitForLoadState('networkidle')
  expect(await refusees(), 'page d’une recette').toEqual([])

  await page.goto('/FridgePlus/community')
  await page.waitForLoadState('networkidle')
  expect(await refusees(), 'communauté').toEqual([])
})
