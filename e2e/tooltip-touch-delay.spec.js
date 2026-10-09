import { test, expect, devices } from '@playwright/test'

// Retour utilisateur 2026-07-11 : plus aucune bulle de tooltip sur tactile
// (téléphone/tablette) — le survol est exclusif au desktop. Remplace l'ancien
// comportement "tap ouvre puis referme après 1300ms" (fix du 2026-07-10),
// devenu obsolète suite à ce retour explicite. Voir src/shared/ui/tooltip.jsx
// pour le détail (détection (hover: hover) and (pointer: fine), alignée sur
// InfoTooltip).

async function skipOnboardingOverlays(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fridge-welcome-seen-v1', '1')
    localStorage.setItem('fridge-consent-v1', JSON.stringify({
      version: 2, timestamp: Date.now(), bannerDismissed: true,
      essential: true, errors: false, usage: false, voice: false, receiptScan: false,
    }))
  })
}

test.describe('Tooltip — aucune bulle sur appareil tactile', () => {
  // Émulation d'un vrai mobile (isMobile + hasTouch, pas juste hasTouch)
  // pour que (hover: hover) / (pointer: fine) reflètent bien un appareil
  // tactile — c'est cette media query, pas juste la présence d'événements
  // touch, qui pilote la désactivation du Tooltip. `defaultBrowserType` du
  // preset est omis : figé par la config du projet (desktop-chromium),
  // incompatible avec un test.use() au niveau describe.
  const { defaultBrowserType: _omit, ...pixel7 } = devices['Pixel 7']
  test.use({ ...pixel7 })

  test('un tap sur "Aide & infos" n\'affiche jamais de bulle tooltip', async ({ page }) => {
    await skipOnboardingOverlays(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const button = page.getByRole('button', { name: 'Aide & infos' })
    await button.tap()

    await expect(page.getByRole('dialog', { name: 'Aide & infos' })).toBeVisible()
    await expect(page.getByRole('tooltip', { name: 'Aide & infos' })).not.toBeVisible()
  })
})

test.describe('Tooltip — toujours actif au survol souris desktop', () => {
  test('le survol souris sur "Aide & infos" affiche bien la bulle', async ({ page }) => {
    await skipOnboardingOverlays(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Aide & infos' }).hover()

    await expect(page.getByRole('tooltip', { name: 'Aide & infos' })).toBeVisible()
  })
})
