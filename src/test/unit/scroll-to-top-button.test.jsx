// La flèche « remonter en haut » réserve la zone qu'elle occupe, et se range
// sur l'échelle de z-index du dépôt.
//
// ── Le défaut vu par le mainteneur le 2026-09-11 ────────────────────────
// Le bouton est `fixed` (44 px, à 88 px du bas, à 24 px de la droite) et
// aucune page ne réservait sa zone. Mesuré sur le build (390×844), en fin de
// défilement : sur /faq et /guide il s'assoit sur le coin de la carte « Prêt à
// cuisiner ? », collé au lien « Comment ça marche → » ; sur /changelog il
// RECOUVRE le texte de la dernière entrée — et comme on est en bas, aucun
// défilement ne peut l'en sortir. Sur desktop la colonne (≤ 860 px) est
// centrée et la flèche vit dans la marge : rien à réserver au-delà de `lg`
// (1 024 px ≥ 860 + 2 × 68).
//
// C'est la même classe de défaut que le bandeau cookies du 28/08 : une
// surface fixe que personne ne réserve. Même remède : elle réserve elle-même.
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ScrollToTopButton, { SCROLL_TO_TOP_RESERVED_HEIGHT } from '@shared/ui/scroll-to-top-button'
import { Z_INDEX } from '@shared/lib/z-index'

beforeEach(() => {
  cleanup()
  document.body.innerHTML = '<main></main>'
})

describe('flèche « remonter en haut »', () => {
  it('réserve, à la fin de la page, la hauteur de la zone qu’elle occupe (bas 88 px + 44 px)', () => {
    render(<ScrollToTopButton lang="fr" />)
    const reserve = document.querySelector('[data-role="reserve-fleche"]')
    expect(reserve).not.toBeNull()
    expect(reserve.getAttribute('aria-hidden')).toBe('true')
    expect(SCROLL_TO_TOP_RESERVED_HEIGHT).toBeGreaterThanOrEqual(88 + 44)
    expect(reserve.style.height).toBe(`${SCROLL_TO_TOP_RESERVED_HEIGHT}px`)
  })

  it('ne réserve rien à partir de `lg`, où la colonne centrée laisse la flèche dans la marge', () => {
    render(<ScrollToTopButton lang="fr" />)
    const reserve = document.querySelector('[data-role="reserve-fleche"]')
    expect(reserve.className.split(/\s+/)).toContain('lg:hidden')
  })

  it('prend son z-index sur l’échelle centralisée : au-dessus du contenu, sous les tiroirs, toasts et modales', () => {
    render(<ScrollToTopButton lang="fr" />)
    const bouton = screen.getByRole('button', { name: 'Remonter en haut' })
    expect(Number(bouton.style.zIndex)).toBe(Z_INDEX.CONTENT_FRONT)
    expect(Z_INDEX.CONTENT_FRONT).toBeLessThan(Z_INDEX.DRAWER_BACKDROP)
  })

  it('reste invisible et non cliquable tant qu’on n’a pas défilé', () => {
    render(<ScrollToTopButton lang="fr" />)
    const bouton = screen.getByRole('button', { name: 'Remonter en haut' })
    expect(bouton.style.opacity).toBe('0')
    expect(bouton.style.pointerEvents).toBe('none')
  })
})
