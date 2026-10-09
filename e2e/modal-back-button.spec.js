import { test, expect } from '@playwright/test'

// Vérifie que le bouton/geste "retour" ferme la modale ouverte au lieu de
// naviguer en dessous (retour utilisateur 2026-07-11 : "on voit juste le
// fond changer, mais pas la modale"). Mécanisme : useCloseOnBackButton
// (src/shared/hooks/use-close-on-back-button.js), câblé modale par modale.

test('back button closes Aide & infos modal instead of navigating away', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-welcome-seen-v1', '1')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, timestamp: Date.now(), bannerDismissed: true,
      essential: true, errors: false, usage: false, voice: false, receiptScan: false,
    }))
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Aide & infos' }).click()
  await expect(page.getByRole('dialog', { name: 'Aide & infos' })).toBeVisible()

  await page.goBack()

  await expect(page.getByRole('dialog', { name: 'Aide & infos' })).not.toBeVisible()
  // Toujours sur la home, pas navigué ailleurs
  expect(page.url()).toContain('/')
})

test('back button closes the "connecte-toi" receipt-scan overlay instead of navigating away', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-welcome-seen-v1', '1')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, timestamp: Date.now(), bannerDismissed: true,
      essential: true, errors: false, usage: false, voice: false, receiptScan: false,
    }))
  })
  await page.route('**/rest/v1/feature_flags*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { key: 'receipt_scan', enabled: true, label: 'Scan de ticket de caisse', description: '' },
      ]),
    })
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Actions rapides' }).click()
  // FAB 2026-08-27 : plus de sous-menu — « Photo du ticket » est directement
  // visible sous le titre de section « Remplir » (2026-09-11 ; « Ajouter des ingrédients » avant).
  await page.getByText('Photo du ticket').click()
  await expect(page.getByText('Connecte-toi pour scanner ton ticket de caisse.')).toBeVisible()

  await page.goBack()

  await expect(page.getByText('Connecte-toi pour scanner ton ticket de caisse.')).not.toBeVisible()
  expect(page.url()).toContain('/')
})
