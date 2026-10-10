import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, assertNoUnmockedCalls, skipOnboardingOverlays, signedInAs, mockAuthUser, mockActivityLogs,
} from './support/supabase-mock.js'

// Décision du 2026-10-08 : changer d'adresse e-mail depuis « Identifiants »
// (Compte & sécurité). La demande part au service d'authentification avec la
// nouvelle adresse et l'adresse de retour du lien ; l'actuelle reste valable
// jusqu'au clic.
//
// La base est simulée (un seul projet Supabase, celui de production).

test('le lien part à la nouvelle adresse, et la page dit où le trouver', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await signedInAs(page, { profile: { language: 'fr' } })
  await mockAuthUser(page)
  await mockActivityLogs(page)
  const demandes = []
  await page.route('**/auth/v1/user**', (route) => {
    const req = route.request()
    if (req.method() !== 'PUT') return route.fallback()
    demandes.push({ corps: JSON.parse(req.postData() ?? '{}'), adresse: req.url() })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000002', email: 'a@b.co', new_email: 'nouvelle@test.com', aud: 'authenticated', role: 'authenticated' }),
    })
  })

  await page.goto('/FridgePlus/profile/compte')
  await page.getByRole('textbox', { name: 'Nouvelle adresse e-mail' }).fill('nouvelle@test.com')
  await page.getByRole('button', { name: 'Envoyer le lien de confirmation' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Ouvre le lien reçu à nouvelle@test.com pour confirmer.' })).toBeVisible()
  const changement = demandes.find((d) => d.corps.email)
  expect(changement?.corps.email).toBe('nouvelle@test.com')
  expect(changement?.adresse).toMatch(/redirect_to=/)
  assertNoUnmockedCalls(page)
})
