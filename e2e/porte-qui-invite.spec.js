import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// P2 — audit d'intuitivité du 2026-10-02 : la porte fermée était un panneau
// blanc muet, sans rien qui invite à la toucher (même après 8 s). Tant que le
// frigo est vide, elle le dit ; ensuite elle se tait (divulgation progressive).

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('frigo vide : la porte invite à la toucher, et l’ouvre', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // L'accueil monte le frigo mobile ET le frigo bureau (l'un caché)
  const invite = page.getByText('Touche pour ouvrir').filter({ visible: true })
  await expect(invite).toBeVisible()
  const porte = page.getByRole('button', { name: 'Ouvrir le frigo' }).filter({ visible: true })
  await porte.click()
  // Porte ouverte : elle glisse (clip-path, invisible pour Playwright) et sort
  // de l'ordre de tabulation
  await expect(porte).toHaveAttribute('tabindex', '-1')
})

test('frigo rempli : la porte se tait', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.addInitScript(() => localStorage.setItem('fridge-stock', JSON.stringify(['fr-beurre-doux'])))
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'Ouvrir le frigo' }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Touche pour ouvrir')).toHaveCount(0)
})
