import { test, expect } from '@playwright/test'
import { BOOT_TABLES, installSupabaseMocks, skipOnboardingOverlays, signedInAs } from './support/supabase-mock.js'

// Un droit RGPD ne dépend pas d'un abonnement (audit du 2026-10-04, PREM-11) :
// l'opposition au profilage (art. 21) et l'effacement de l'historique de
// dépenses (art. 17) n'étaient proposés qu'aux Premium. Quelqu'un dont
// l'abonnement s'arrête gardait ses dépenses en base sans pouvoir ni s'opposer
// ni effacer. Ici, un compte SANS Premium voit les deux sections.

test('sans Premium, la page Compte propose l’opposition au profilage et l’effacement des dépenses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('fridge-lang', 'fr') })
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.route('**/rest/v1/**', (route) => {
    const methode = route.request().method()
    const table = new URL(route.request().url()).pathname.split('/rest/v1/')[1]?.split('?')[0] ?? ''
    if (BOOT_TABLES.includes(table)) return route.fallback()
    if (methode === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    if (methode === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' })
    return route.fallback()
  })
  // Profil sans abonnement : `subscription_status` absent = gratuit.
  await signedInAs(page, { profile: { language: 'fr' } })

  await page.goto('/FridgePlus/profile/compte')
  await page.waitForLoadState('networkidle')

  // L'opposition vit dans « Confidentialité », repliée par défaut.
  await page.getByRole('button', { name: /confidentialité/i }).click()
  await expect(page.getByText('Opposition au profilage')).toBeVisible()
  // Le titre, par son rôle : la description de l’opposition au profilage cite
  // « Supprimer mon historique de dépenses » (le même nom, depuis la décision du 2026-10-08).
  await expect(page.getByRole('heading', { name: 'Supprimer mon historique de dépenses' })).toBeVisible()
})
