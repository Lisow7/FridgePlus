import { test, expect } from '@playwright/test'
import { BOOT_TABLES, installSupabaseMocks, skipOnboardingOverlays, signedInAs, mockRpc, rpcCalls } from './support/supabase-mock.js'

// Audit du 2026-10-04, ADM-03 : une annonce partait dans la cloche de TOUS les
// comptes au premier clic. Elle demande désormais confirmation. Ce parcours
// réel prouve aussi l'ordre d'affichage : la confirmation s'ouvre AU-DESSUS de
// la fenêtre de rédaction (z-index 9999, dans le panneau admin) — un clic
// Playwright échoue si un autre élément intercepte le pointeur.

test.use({ viewport: { width: 1280, height: 900 } })

test('une annonce à tous demande confirmation : « Revenir » n’envoie rien, « Envoyer à tous » envoie', async ({ page }) => {
  test.setTimeout(60000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.route('**/rest/v1/**', (route) => {
    const methode = route.request().method()
    const table = new URL(route.request().url()).pathname.split('/rest/v1/')[1]?.split('?')[0] ?? ''
    if (BOOT_TABLES.includes(table) || table.startsWith('rpc/')) return route.fallback()
    if (methode === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    if (methode === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' })
    return route.fallback()
  })
  await mockRpc(page, 'admin_send_notification', { id: 'n-1' })
  await signedInAs(page, { profile: { role: 'admin', language: 'fr', created_at: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString() } })
  // Le tableau de bord (premier écran du panneau) lit les dates d'inscription
  // en LISTE ; le simulacre du compte sert le profil en objet unique.
  await page.route('**/rest/v1/profiles**', (route) => (
    route.request().url().includes('select=created_at')
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      : route.fallback()
  ))

  await page.goto('/FridgePlus/')
  await page.getByRole('button', { name: 'Menu utilisateur' }).click()
  await page.getByText('Panneau admin').click()
  const panneau = page.getByRole('dialog', { name: 'Fridge+ Admin' })
  const sections = panneau.getByRole('navigation', { name: 'Sections du panneau admin' })
  await sections.getByRole('button', { name: /Notifications/ }).click()
  await expect(sections.getByRole('button', { name: /Notifications/ })).toHaveAttribute('aria-current', 'page')

  await panneau.getByRole('button', { name: /^Envoyer$/ }).click()
  const redaction = page.getByRole('dialog', { name: 'Envoyer une notification' })
  await expect(redaction).toBeVisible()
  await redaction.getByRole('button', { name: /Annonce/ }).click()
  await redaction.getByLabel('Titre (FR) *').fill('Maintenance ce soir')
  await redaction.getByRole('button', { name: /^Envoyer$/ }).click()

  const question = page.getByRole('dialog', { name: 'Envoyer à tous les comptes ?' })
  await expect(question).toBeVisible()
  await question.getByRole('button', { name: 'Revenir au message' }).click()
  await expect(question).toBeHidden()
  expect(rpcCalls(page, 'admin_send_notification')).toHaveLength(0)
  await expect(redaction.getByLabel('Titre (FR) *')).toHaveValue('Maintenance ce soir')

  await redaction.getByRole('button', { name: /^Envoyer$/ }).click()
  await question.getByRole('button', { name: 'Envoyer à tous' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Notification envoyée' })).toBeVisible()
  expect(rpcCalls(page, 'admin_send_notification')).toHaveLength(1)
  expect(rpcCalls(page, 'admin_send_notification')[0].args).toMatchObject({ p_type: 'announcement', p_recipient_id: null })
})
