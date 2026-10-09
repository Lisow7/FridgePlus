import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04, A11Y-14 : la communauté s'affiche en plein écran
// PAR-DESSUS l'application, dont l'en-tête restait monté et atteignable : au
// clavier, on traversait d'abord ses boutons, invisibles sous la page. Elle
// est maintenant une fenêtre (rôle, nom, `aria-modal`) qui garde le focus.

test('communauté : la tabulation ne quitte jamais la page plein écran', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
  await page.goto('/FridgePlus/community')

  const fenetre = page.getByRole('dialog', { name: 'Communauté' })
  await expect(fenetre).toBeVisible()
  await expect(fenetre).toHaveAttribute('aria-modal', 'true')

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    const ou = await page.evaluate(() => {
      const el = document.activeElement
      const dialogue = document.querySelector('[role="dialog"][aria-label="Communauté"]')
      return { dedans: !!dialogue?.contains(el), dansEntete: !!el?.closest('header:not([role="dialog"] header)') }
    })
    expect(ou.dansEntete, `Tab n° ${i + 1} : focus dans l’en-tête recouvert`).toBe(false)
    expect(ou.dedans, `Tab n° ${i + 1} : focus sorti de la communauté`).toBe(true)
  }
})
