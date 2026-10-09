import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04, A11Y-11 : 23 `@keyframes` et des dizaines d'animations
// en ligne, dont beaucoup en boucle, que « réduire les animations » ne
// touchait pas. Le point « nouveauté » du pied de page en est un : il pulse
// à l'infini, en style en ligne. Le bloc global d'`index.css` le ramène à un
// seul passage quand le système le demande — et seulement dans ce cas.

for (const [preference, attendu] of [['reduce', '1'], ['no-preference', 'infinite']]) {
  test(`préférence « ${preference} » : le point du pied de page pulse ${attendu === '1' ? 'une fois' : 'en boucle (témoin)'}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: preference })
    // Le point n'apparaît qu'à qui revient après une nouvelle version : au
    // premier passage, rien n'est annoncé (UX-11, lot 13b).
    await page.addInitScript(() => {
      window.localStorage.setItem('fridge-lang', 'fr')
      window.localStorage.setItem('fridge-last-seen-version', '0.1')
    })
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
    await page.goto('/FridgePlus/faq')
    const point = page.locator('[style*="fridge-version-pulse"]').first()
    await expect(point).toBeAttached()
    expect(await point.evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe(attendu)
  })
}
