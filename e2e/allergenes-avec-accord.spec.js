import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays, signedInAs, mockRpc, rpcCalls } from './support/supabase-mock.js'

// Décision du 2026-10-06, choix d'Antoine (« allergenes = case ») : pour un
// compte, une case avant le premier enregistrement — une donnée de santé ne
// part qu'avec un accord explicite, daté par la base. Prouvé dans le navigateur.

test('un compte : la case d’abord, puis ses allergènes', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await signedInAs(page, {
    profile: {
      username_confirmed: true,
      consent_terms_accepted_at: '2026-10-06T10:00:00+00:00',
      consent_privacy_accepted_at: '2026-10-06T10:00:00+00:00',
      allergen_prefs: [], allergen_consent_at: null,
    },
  })
  await mockRpc(page, 'accepter_l_enregistrement_des_allergenes', '2026-10-06T12:00:00+00:00')
  await page.goto('/FridgePlus/profile/preferences')

  const accord = page.getByRole('checkbox', { name: /J['’]accepte que Fridge\+ enregistre mes allergènes pour filtrer les recettes/ })
  await expect(accord).toBeVisible()
  await expect(accord).not.toBeChecked()
  // Les types d'allergènes ne sont pas servis ici : c'est « Enregistrer » qui
  // dit si la section répond.
  const enregistrer = page.getByRole('button', { name: 'Enregistrer', exact: true })
  await expect(enregistrer).toBeDisabled()

  await accord.check()
  await expect(accord).toBeChecked()
  expect(rpcCalls(page, 'accepter_l_enregistrement_des_allergenes')).toHaveLength(1)
  await expect(enregistrer).toBeEnabled()
})
