import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'
import { CURRENT_VERSION } from '../src/shared/lib/version.js'

// Audit du 2026-10-04, UX-11 : un visiteur qui découvrait l'app voyait, au pied
// de la page, le point qui pulse et « Nouveautés disponibles ». Au premier
// passage, rien n'est annoncé et la version du jour est notée ; une version
// plus tard, les nouveautés le sont.

test.use({ viewport: { width: 1440, height: 900 } })

const badge = (page) => page.getByRole('link', { name: new RegExp(`v${CURRENT_VERSION.replace(/[.]/g, '\\.')}`) }).first()

test('premier passage : la version se voit, sans « Nouveautés disponibles »', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await expect(badge(page)).toBeVisible({ timeout: 15000 })
  await expect(badge(page)).not.toHaveAttribute('aria-label', /Nouveautés disponibles/)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fridge-last-seen-version'))).toBe(CURRENT_VERSION)
})

test('une version plus tard : les nouveautés sont annoncées', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-lang', 'fr')
    localStorage.setItem('fridge-last-seen-version', '0.1')
  })
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await expect(badge(page)).toHaveAttribute('aria-label', /Nouveautés disponibles/, { timeout: 15000 })
})
