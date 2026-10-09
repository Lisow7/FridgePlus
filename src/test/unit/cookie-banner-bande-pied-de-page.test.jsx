// Le bandeau cookies est une BANDE pleine largeur posée au-dessus du pied de page.
//
// ── Deux défauts, deux dates ──────────────────────────────────────────────
// 2026-09-11 — sur un écran de 2 556 px, le frigo est centré verticalement dans
// l'espace restant : réserver la hauteur du bandeau le faisait remonter de
// ~80 px tant que le bandeau était là, puis redescendre à la décision. Un
// premier visiteur voyait son frigo sauter. Remède conservé ici : au-dessus du
// seuil, la page d'accueil NE RÉSERVE PLUS (`min-[1600px]:pb-0`). En dessous,
// elle réserve — c'est ce qui garde les bacs du bas atteignables.
//
// 2026-09-12 — le remède d'alors était une carte de coin de 380 px, qui
// flottait en bas à droite sans rapport avec rien. Signalée par le mainteneur.
// Et la mesure a révélé bien pire que l'esthétique : posé à `bottom: 16px`, le
// bandeau était PAR-DESSUS le pied de page. Mesuré à 1400 px, il recouvrait
// « Questions fréquentes », « Aide & Mentions légales » et « Cookies » ; à
// 360 px, des bacs du frigo en plus.
//
// 🔴 Personne ne l'avait vu, et la raison mérite d'être écrite : le cliquet du
// pied de page (`surfaces-atteignables.spec.js`) pose le consentement dans le
// `localStorage` pour arriver sur une page propre — donc le bandeau n'y est
// JAMAIS affiché. Un cliquet ne protège que ce qu'il visite.
//
// 🥇 La bande se cale désormais sur `--fp-footer-height`, publiée par le pied de
// page lui-même. Elle ne peut plus le recouvrir : c'est la GÉOMÉTRIE qui
// l'interdit, pas un z-index. Même doctrine que partout ailleurs dans ce dépôt —
// deux surfaces se séquencent, elles ne s'empilent pas.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import CookieBanner, { COOKIE_BANNER_LIGNE_MIN_WIDTH } from '@features/legal/components/cookie-banner'
import { BOTTOM_INSET_VAR, FOOTER_HEIGHT_VAR } from '@shared/hooks/use-bottom-inset'

const largeurInitiale = window.innerWidth
const lireInset = () => document.documentElement.style.getPropertyValue(BOTTOM_INSET_VAR)

function rendreA(largeur) {
  window.innerWidth = largeur
  return render(<CookieBanner lang="fr" />)
}

beforeEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.style.removeProperty(BOTTOM_INSET_VAR)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    height: 150, width: 380, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => {},
  })
})

afterEach(() => {
  window.innerWidth = largeurInitiale
  vi.restoreAllMocks()
})

describe('bandeau cookies — une bande, jamais par-dessus le pied de page', () => {
  it('expose un seuil de grand écran, consommé aussi par la mise en page', () => {
    expect(COOKIE_BANNER_LIGNE_MIN_WIDTH).toBe(1600)
  })

  // Le cœur du correctif du 2026-09-12, et il vaut à TOUTES les largeurs : la
  // bande se cale sur la hauteur publiée par le pied de page, donc au-dessus de
  // lui. Un `bottom: 16px` la remettrait par-dessus.
  for (const largeur of [360, 1100, 1400, COOKIE_BANNER_LIGNE_MIN_WIDTH, 2560]) {
    it(`à ${largeur}px : bande pleine largeur, calée sur la hauteur du pied de page`, () => {
      rendreA(largeur)
      const bandeau = screen.getByRole('dialog')
      expect(bandeau.style.left).toBe('0px')
      expect(bandeau.style.right).toBe('0px')
      expect(bandeau.style.maxWidth).toBe('none')
      expect(
        bandeau.style.bottom,
        'La bande doit se caler sur `--fp-footer-height` : une valeur en dur la ' +
        'reposerait par-dessus le pied de page, le défaut du 2026-09-12.',
      ).toBe(`var(${FOOTER_HEIGHT_VAR}, 0px)`)
      // Une bande n'a pas de coins arrondis : elle touche les deux bords.
      expect(bandeau.style.borderRadius).toBe('0px')
    })
  }

  it('publie TOUJOURS sa hauteur — la fusée et les toasts du coin doivent monter au-dessus', () => {
    rendreA(COOKIE_BANNER_LIGNE_MIN_WIDTH + 400)
    expect(lireInset()).toBe('150px')
  })

  it('sous le seuil, publie aussi sa hauteur — c’est ce que réserve l’accueil', () => {
    rendreA(COOKIE_BANNER_LIGNE_MIN_WIDTH - 1)
    expect(lireInset()).toBe('150px')
  })
})
