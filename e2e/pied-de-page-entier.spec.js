import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04 : à 1024 px de large, le pied de page passait à sa ligne
// « ordinateur » (logo, guide, FAQ, mentions, cookies, nom de la version, ©),
// qui a besoin d'environ 1170 px. Centrée et sans retour à la ligne, elle
// débordait des deux côtés : trois éléments étaient hors de l'écran.
// La ligne longue n'apparaît plus qu'à partir de 1280 px, largeur à laquelle
// l'app passe elle-même en disposition ordinateur.
for (const largeur of [1024, 1100, 1200, 1279, 1280, 1366]) {
  test(`${largeur} px : tout le pied de page est dans l’écran`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 })
    await skipOnboardingOverlays(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const horsEcran = await page.evaluate(() => {
      const pied = document.querySelector('footer')
      return [...pied.querySelectorAll('a, button, span')]
        .filter(e => e.getClientRects().length > 0 && e.textContent.trim())
        .map(e => ({ texte: e.textContent.trim().slice(0, 30), gauche: Math.round(e.getBoundingClientRect().left), droite: Math.round(e.getBoundingClientRect().right) }))
        .filter(e => e.gauche < 0 || e.droite > window.innerWidth)
    })
    expect(horsEcran, 'éléments du pied de page hors de l’écran').toEqual([])
  })
}
