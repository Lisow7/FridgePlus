import { test, expect } from '@playwright/test'
import { installSupabaseMocks, skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04, A11Y-15 (WCAG 2.4.11, « focus non masqué »), « à
// confirmer au navigateur ». L'en-tête est fixe au-dessus du contenu qui
// défile : en remontant au clavier (Maj+Tab), l'élément focalisé défilait
// jusqu'au bord du conteneur — sous l'en-tête, invisible. Ici, on descend au
// clavier jusqu'à faire défiler la page, puis on remonte : chaque élément
// focalisé dans le contenu doit rester sous l'en-tête.

for (const largeur of [1280, 390]) {
  test(`en remontant au clavier, le focus n’est jamais caché sous l’en-tête (${largeur} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 640 })
    await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
    await skipOnboardingOverlays(page)
    await installSupabaseMocks(page)
    await page.goto('/FridgePlus/faq')
    const main = page.locator('#contenu-principal')
    await expect(main).toBeVisible()

    let defile = false
    for (let i = 0; i < 120 && !defile; i++) {
      await page.keyboard.press('Tab')
      defile = await main.evaluate((m) => m.scrollTop > 400)
    }
    expect(defile, 'la page doit défiler au clavier, sinon le test ne prouve rien').toBe(true)

    let verifies = 0
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Shift+Tab')
      const r = await page.evaluate(() => {
        const el = document.activeElement
        const contenu = document.getElementById('contenu-principal')
        if (!el || el === contenu || !contenu.contains(el)) return null
        return { haut: el.getBoundingClientRect().top, basEntete: document.querySelector('header').getBoundingClientRect().bottom }
      })
      if (!r) continue
      verifies++
      expect(r.haut, 'élément focalisé caché sous l’en-tête').toBeGreaterThanOrEqual(r.basEntete - 1)
    }
    expect(verifies, 'assez d’éléments vérifiés en remontant').toBeGreaterThan(5)
  })
}
