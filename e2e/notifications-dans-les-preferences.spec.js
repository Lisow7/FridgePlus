import { test, expect } from '@playwright/test'
import { installSupabaseMocks, assertNoUnmockedCalls, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// Décision du 2026-10-08 : les notifications se règlent dans Profil →
// Préférences (l'appareil, puis les trois envois), plus dans la fenêtre des
// cookies ; « Régler les notifications » (cloche vide) y mène.
//
// La base est simulée (un seul projet Supabase, celui de production).

const notificationsAllumees = (page) => page.route('**/rest/v1/feature_flags*', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify([{ key: 'push_notifications', enabled: true, label: 'Notifications', description: '' }]),
}))

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await signedInAs(page, { profile: { language: 'fr', push_preferences: { inactivity_reminder: true, announcements: true, stock_expiry: true } } })
  await notificationsAllumees(page)
})

test('« Régler les notifications » mène au bloc des Préférences : l’appareil d’abord', async ({ page }) => {
  await page.goto('/FridgePlus/')
  await page.getByRole('button', { name: 'Notifications' }).click()
  await page.getByRole('button', { name: 'Régler les notifications' }).click()
  await expect(page).toHaveURL(/\/FridgePlus\/profile\/preferences#notifications$/)
  await expect(page.getByText('Notifications sur cet appareil')).toBeVisible()
  // Pas encore abonné sur cet appareil : l'interrupteur de l'appareil, et lui seul.
  await expect(page.getByRole('switch', { name: 'Activer sur cet appareil' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('switch', { name: 'Annonces de l’équipe' })).toHaveCount(0)
  assertNoUnmockedCalls(page)
})

test('la fenêtre des cookies ne parle plus des notifications', async ({ page }) => {
  await page.goto('/FridgePlus/')
  await page.getByRole('link', { name: 'Cookies' }).or(page.getByRole('button', { name: 'Cookies' })).first().click()
  await expect(page.getByRole('dialog', { name: '🍪 Cookies et données' })).toBeVisible()
  await expect(page.getByText(/Notifications push/)).toHaveCount(0)
})

// Vu le 2026-10-15 sur localhost:5173 : « Activer » demandait la permission puis restait
// « en cours » pour toujours — sous `npm run dev` (ce serveur-ci), il n'y a pas de service
// worker. L'interrupteur répond tout de suite, et la note dit comment tester.
test('sur le serveur de développement, « Activer » répond tout de suite et dit comment tester', async ({ page }) => {
  await page.goto('/FridgePlus/profile/preferences#notifications')
  const appareil = page.getByRole('switch', { name: 'Activer sur cet appareil' })
  await appareil.click()
  await expect(page.getByRole('alert').filter({ hasText: 'npm run build, puis npm run preview' })).toBeVisible()
  await expect(appareil).toHaveAttribute('aria-checked', 'false')
  await expect(appareil).toBeEnabled()
  assertNoUnmockedCalls(page)
})
