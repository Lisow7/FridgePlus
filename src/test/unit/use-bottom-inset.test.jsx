// Contrat de mise en page du bas d'écran.
//
// Le bandeau cookies est une surface `fixed` opaque de 237 à 256 px que
// personne ne réservait : mesuré le 2026-08-28 en PRODUCTION, il rendait
// incliquables le sélecteur de langue, la bascule de thème, les compartiments
// bas du frigo et le bouton « remonter en haut » des pages SEO (hit-test 5/5).
// Le classement des z-index ne pouvait pas corriger ça — quel que soit le
// vainqueur, quelqu'un reste caché. D'où ce contrat : la surface publie sa
// hauteur, les autres la consomment.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useRef } from 'react'
import { BOTTOM_INSET_VAR, useBottomInsetPublisher } from '@shared/hooks/use-bottom-inset'

function Surface({ active, hauteur = 240 }) {
  const ref = useRef(null)
  useBottomInsetPublisher(ref, active)
  return <div ref={ref} style={{ height: hauteur }}>bandeau</div>
}

const lire = () => document.documentElement.style.getPropertyValue(BOTTOM_INSET_VAR)

beforeEach(() => {
  cleanup()
  document.documentElement.style.removeProperty(BOTTOM_INSET_VAR)
  // jsdom ne calcule aucune taille : on simule une hauteur réelle mesurable.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    height: 240, width: 358, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => {},
  })
})

describe('useBottomInsetPublisher — réservation de l’espace bas', () => {
  it('publie la hauteur de la surface quand elle est affichée', () => {
    render(<Surface active />)
    expect(lire()).toBe('240px')
  })

  it('ne réserve RIEN quand la surface est absente (aucun décalage pour les autres)', () => {
    render(<Surface active={false} />)
    expect(lire() === '' || lire() === '0px').toBe(true)
  })

  it('libère l’espace au démontage — sinon la page garde un trou à vie', () => {
    const { unmount } = render(<Surface active />)
    expect(lire()).toBe('240px')
    unmount()
    expect(lire() === '' || lire() === '0px').toBe(true)
  })

  it('expose un nom de variable stable, consommable en CSS', () => {
    expect(BOTTOM_INSET_VAR).toBe('--fp-bottom-inset')
  })
})
