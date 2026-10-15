import { expect } from '@playwright/test'

// Mesure partagée par `cibles-tactiles.spec.js` (visiteur) et
// `cibles-tactiles-connecte.spec.js` (compte connecté) — WCAG 2.2, 2.5.8
// « Taille de la cible (minimum) », niveau AA : 24 × 24 px.
// Seule exception tolérée : les liens du pied de page, espacés (exception
// « espacement » du critère : un cercle de 24 px centré ne touche aucune autre cible).

// « Mentions légales » s'appelait « Aide & Mentions légales » avant la décision du 2026-10-08 (lot 13d).
// « Accessibilité » les a rejoints le 2026-10-10 (même décision) : même ligne, même espacement.
export const EXCEPTIONS = /^(Mentions légales|Accessibilité|Accessibility|Cookies|v\d+\.\d+.*)$/

export async function ciblesTropPetites(page) {
  return page.evaluate(() => {
    const sel = 'button, a[href], [role="button"], input:not([type="hidden"]), select, [role="menuitem"], [role="tab"]'
    const visible = (el) => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight
    }
    return [...document.querySelectorAll(sel)].filter(visible).map((el) => {
      // Une case ou une liste dans un <label> : tout le label reçoit le geste
      // (une case native fait 13 px ; c'est le label qu'on vise).
      const cible = (el.matches('input, select') && el.closest('label')) || el
      const r = cible.getBoundingClientRect()
      const nom = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
      return { nom, l: Math.round(r.width), h: Math.round(r.height) }
    }).filter((c) => c.l < 24 || c.h < 24)
  })
}

export async function verifierLesCibles(page, ecran, exceptions = EXCEPTIONS) {
  const fautes = (await ciblesTropPetites(page)).filter((c) => !exceptions.test(c.nom))
  expect(fautes, `${ecran} : cibles sous 24 px`).toEqual([])
}
