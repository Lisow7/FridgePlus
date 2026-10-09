import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04 (P-02). En disposition ordinateur, le frigo fait 680 px de
// haut et son échelle ne descendait jamais sous 1 : sur un portable il passait
// sous l'en-tête et sous le pied de page, dans une zone qui ne défile pas. Plus
// de sommet, plus de titre « Garde-manger », bas des bacs coupé — sur l'écran
// d'accueil, celui que tout visiteur voit en premier.
//
// Les tailles sont celles de fenêtres RÉELLES de portables (barres du
// navigateur déduites), plus deux grands écrans pour vérifier que rien n'y a
// changé. Le test mesure la rangée frigo + garde-manger contre l'en-tête et le
// pied : il ne suppose rien de la formule.
const TAILLES = [
  [1280, 600], [1366, 650], [1280, 720], [1366, 768], [1280, 800],
  [1440, 900], [1920, 1080],
]

for (const [largeur, hauteur] of TAILLES) {
  test(`${largeur} × ${hauteur} : le frigo et le garde-manger tiennent entre l’en-tête et le pied`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur })
    await skipOnboardingOverlays(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const rangee = page.locator('[data-desktop-fridge-row]')
    await expect(rangee).toBeVisible()

    const mesurer = () => page.evaluate(() => {
      const r = document.querySelector('[data-desktop-fridge-row]').getBoundingClientRect()
      return {
        haut: r.top, bas: r.bottom,
        basEntete: document.querySelector('header').getBoundingClientRect().bottom,
        hautPied: document.querySelector('footer').getBoundingClientRect().top,
      }
    })

    // L'échelle s'applique avec une transition : on attend qu'elle soit posée.
    await expect.poll(async () => {
      const a = await mesurer()
      await page.waitForTimeout(150)
      const b = await mesurer()
      return Math.abs(a.haut - b.haut) < 0.5 && Math.abs(a.bas - b.bas) < 0.5
    }, { timeout: 5000 }).toBe(true)

    const m = await mesurer()
    expect(m.haut, 'le haut du frigo n’est pas sous l’en-tête').toBeGreaterThanOrEqual(m.basEntete - 1)
    expect(m.bas, 'le bas du frigo n’est pas sous le pied de page').toBeLessThanOrEqual(m.hautPied + 1)
  })
}
