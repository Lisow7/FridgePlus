import { test, expect } from '@playwright/test'
import { skipOnboardingOverlays } from './support/supabase-mock.js'

// WCAG 2.2 — 2.5.8 « Taille de la cible (minimum) », niveau AA : 24 × 24 px.
// Mesuré le 2026-10-02 (audit d'intuitivité) : la croix « Masquer » faisait
// 11 × 20, « Fermer » de l'inventaire 15 × 27, les ± portions 22 × 22.
// Seule exception tolérée : les liens du pied de page, espacés (exception
// « espacement » du critère : un cercle de 24 px centré ne touche aucune autre cible).

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

const EXCEPTIONS = /^(Aide & Mentions légales|Cookies|v\d+\.\d+.*)$/

async function ciblesTropPetites(page) {
  return page.evaluate(() => {
    const sel = 'button, a[href], [role="button"], input:not([type="hidden"]), select, [role="menuitem"], [role="tab"]'
    const visible = (el) => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight
    }
    return [...document.querySelectorAll(sel)].filter(visible).map((el) => {
      const r = el.getBoundingClientRect()
      const nom = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
      return { nom, l: Math.round(r.width), h: Math.round(r.height) }
    }).filter((c) => c.l < 24 || c.h < 24)
  })
}

const verifier = async (page, ecran) => {
  const fautes = (await ciblesTropPetites(page)).filter((c) => !EXCEPTIONS.test(c.nom))
  expect(fautes, `${ecran} : cibles sous 24 px`).toEqual([])
}

test('les cibles des écrans principaux font au moins 24 × 24 px', async ({ page }) => {
  await skipOnboardingOverlays(page)
  await page.addInitScript(() => {
    localStorage.setItem('fridge-stock', JSON.stringify(['fr-beurre-doux', 'fr-oeufs-plein-air', 'gp-spaghetti']))
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await verifier(page, 'Accueil')

  await page.getByRole('button', { name: 'Actions rapides' }).click()
  await page.getByRole('menuitem', { name: /Inventaire/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await verifier(page, 'Inventaire')

  await page.goto('/?recettes=1')
  await page.waitForLoadState('networkidle')
  await verifier(page, 'Panneau Recettes')

  await page.locator('[data-recipe-id]').first().click()
  await page.waitForURL(/\/recipe\//)
  await expect(page.getByRole('button', { name: 'Plus de portions' })).toBeVisible()
  await verifier(page, 'Fiche recette')
})
