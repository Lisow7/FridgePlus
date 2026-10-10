import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays, signedInAs, mockRpc, rpcCalls } from './support/supabase-mock.js'

// Décision du 2026-10-07, choix d'Antoine : un compte créé avant le
// 4 octobre, sans date d'accord aux conditions, voit « Confirme ton accord »
// par-dessus l'app à sa prochaine connexion ; la case cochée, la base date
// l'accord et la fenêtre ne revient plus. Prouvé dans le navigateur.

const ANCIEN = { username_confirmed: true, created_at: '2026-06-12T09:00:00+00:00' }

test('un compte d’avant le 4 octobre : la case, une fois, puis l’app', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await signedInAs(page, { profile: { ...ANCIEN, consent_terms_accepted_at: null, consent_privacy_accepted_at: null } })
  await mockRpc(page, 'record_signup_consent', '2026-10-08T08:00:00+00:00')
  await page.goto('/FridgePlus/')

  const fenetre = page.getByRole('dialog', { name: 'Confirme ton accord' })
  await expect(fenetre).toBeVisible()
  await fenetre.getByRole('checkbox', { name: /J['’]ai au moins 16 ans et j['’]accepte/ }).check()
  await fenetre.getByRole('button', { name: 'Continuer' }).click()

  await expect(fenetre).toHaveCount(0)
  expect(rpcCalls(page, 'record_signup_consent')).toHaveLength(1)
})

test('un compte qui a déjà daté son accord : pas de fenêtre', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await signedInAs(page, { profile: { ...ANCIEN, consent_terms_accepted_at: '2026-10-04T12:00:00+00:00', consent_privacy_accepted_at: '2026-10-04T12:00:00+00:00' } })
  await page.goto('/FridgePlus/')
  // Repère vu présent : l'app est bien affichée, avec le compte connecté.
  await expect(page.getByRole('main')).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByRole('dialog', { name: 'Confirme ton accord' })).toHaveCount(0)
})
