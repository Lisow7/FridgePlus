import { test, expect } from '@playwright/test'
import { BOOT_TABLES, installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// Règle des paliers d'accès (directive du 2026-05-20, ADR 0006) : un visiteur
// sans compte ne rencontre AUCUN point d'entrée Premium ; un compte gratuit
// les voit, verrouillés. L'audit du 2026-10-04 (PREM-08) en avait trouvé
// quatre montrés aux visiteurs : « Substituts IA » sur la fiche, le verrou
// « Mode cuisine » de son pied, « Ce qui arrive » dans le guide, et
// `?modal=upgrade` qui ouvrait la fenêtre Premium à n'importe qui.

async function ouvrirUneFiche(page) {
  await page.goto('/FridgePlus/?recettes=1')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-recipe-id]').first().click()
  await page.waitForURL(/\/recipe\//)
  await expect(page.getByRole('button', { name: 'Plus de portions' })).toBeVisible()
}

test('visiteur : aucune des quatre entrées Premium', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('fridge-lang', 'fr') })
  await skipOnboardingOverlays(page)

  // (Le verrou « Mode cuisine » du pied de fiche est prouvé en unitaire : ici,
  // sans base, les fiches n'ont pas d'étapes, donc pas de pied — pour personne.)
  await ouvrirUneFiche(page)
  await expect(page.getByRole('button', { name: 'Substituts IA' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Aide & infos' }).filter({ visible: true }).first().click()
  await page.getByRole('button', { name: 'Explorer les fonctionnalités' }).click()
  await expect(page.getByText('Le frigo')).toBeVisible()
  await expect(page.getByText('Ce qui arrive')).toHaveCount(0)

  await page.goto('/FridgePlus/?modal=upgrade')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(new URL(page.url()).search).toBe('')
})

test('compte gratuit : les mêmes entrées, verrouillées', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('fridge-lang', 'fr') })
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.route('**/rest/v1/**', (route) => {
    const methode = route.request().method()
    const table = new URL(route.request().url()).pathname.split('/rest/v1/')[1]?.split('?')[0] ?? ''
    if (BOOT_TABLES.includes(table)) return route.fallback()
    if (methode === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    if (methode === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' })
    return route.fallback()
  })
  await signedInAs(page, { profile: { language: 'fr' } })

  await ouvrirUneFiche(page)
  await expect(page.getByRole('button', { name: 'Substituts IA' }).first()).toBeVisible()

  await page.goto('/FridgePlus/?modal=upgrade')
  await expect(page.getByRole('dialog')).toBeVisible()
})
