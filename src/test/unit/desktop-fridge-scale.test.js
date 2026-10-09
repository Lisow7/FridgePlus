import { describe, it, expect } from 'vitest'
import { computeDesktopFridgeScale } from '@app/hooks/use-responsive-layout'

// Échelle du frigo en disposition ordinateur (fenêtre d'au moins 1280 px de large).
//
// Audit du 2026-10-04 (P-02). L'échelle était `max(1, …)` : elle grandissait sur
// un grand écran mais ne descendait jamais sous 1. Le frigo fait 680 px de
// haut ; sur un portable (1366 × 768, 1280 × 720…) il dépassait donc sous
// l'en-tête et le pied de page, dans une zone qui ne défile pas. Mesuré :
// 31 px coupés en haut et 34 en bas à 1366 × 768, 90 et 93 à 1366 × 650.
//
// Les hauteurs disponibles ci-dessous sont celles MESURÉES dans l'app
// (hauteur de la zone principale moins son retrait haut), pas des suppositions.
const FRIGO = 680
const echelle = (viewportHeight, availableHeight) =>
  computeDesktopFridgeScale({ viewportHeight, availableHeight, rowHeight: FRIGO })

describe('computeDesktopFridgeScale', () => {
  it.each([
    ['1366 × 768', 768, 613],
    ['1280 × 720', 720, 565],
    ['1280 × 800', 800, 645],
    ['1366 × 650', 650, 495],
    ['1280 × 600', 600, 445],
  ])('portable %s : le frigo, une fois mis à l’échelle, tient dans la zone disponible', (_nom, vh, dispo) => {
    const s = echelle(vh, dispo)
    expect(s).toBeLessThan(1)
    expect(FRIGO * s).toBeLessThanOrEqual(dispo)
  })

  it('ne rétrécit pas plus que nécessaire : il reste peu de marge autour du frigo', () => {
    const dispo = 613
    const s = echelle(768, dispo)
    expect(dispo - FRIGO * s).toBeLessThan(33)
  })

  it('1440 × 900 : la taille réelle est conservée', () => {
    expect(echelle(900, 745)).toBe(1)
  })

  it('grand écran : il grandit comme avant (1920 × 1080 → 1,13)', () => {
    expect(echelle(1080, 925)).toBeCloseTo(1.13, 2)
  })

  it('très grand écran : il plafonne à 1,4', () => {
    expect(echelle(1440, 1285)).toBe(1.4)
  })

  it('fenêtre minuscule : il ne descend pas sous 0,6 (le texte deviendrait illisible)', () => {
    expect(echelle(420, 265)).toBe(0.6)
  })

  it('hauteur disponible inconnue : on retombe sur la fenêtre moins l’en-tête et le pied', () => {
    const s = echelle(720, null)
    expect(s).toBeLessThan(1)
    expect(s).toBeGreaterThanOrEqual(0.6)
  })

  it('rangée non mesurée : échelle neutre', () => {
    expect(computeDesktopFridgeScale({ viewportHeight: 720, availableHeight: 565, rowHeight: 0 })).toBe(1)
  })
})
