import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04 (UX-01), rejoué d'un vrai clic : pour un visiteur sans
// compte, le gros bouton « Contacter le support » de la fenêtre d'aide
// n'ouvrait rien, puis le bouton orange de l'accueil et la carte d'accueil
// disparaissaient jusqu'au rechargement de la page.
test('sans compte : l’aide propose d’écrire au support, et le bouton orange reste là', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const boutonOrange = page.getByRole('button', { name: 'Actions rapides', exact: true })
  await expect(boutonOrange).toBeVisible()

  await page.getByRole('button', { name: 'Aide & infos' }).filter({ visible: true }).first().click()
  await expect(page.getByRole('button', { name: /Contacter le support/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Écrire au support/ })).toHaveAttribute('href', 'mailto:support@fridgeplus.app')

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Aide & infos' })).toHaveCount(0)
  await expect(boutonOrange).toBeVisible()
})
