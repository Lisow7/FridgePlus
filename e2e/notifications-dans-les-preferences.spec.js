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
