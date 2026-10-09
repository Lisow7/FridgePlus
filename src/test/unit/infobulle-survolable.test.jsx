import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Tooltip from '@shared/ui/tooltip'
import InfoTooltip from '@shared/ui/info-tooltip'
import { UIProvider } from '@shared/contexts/ui-provider'

// WCAG 2.2, 1.4.13 « Contenu au survol ou au focus » : le contenu qui apparaît
// au survol doit pouvoir être SURVOLÉ à son tour, sans disparaître (audit du
// 2026-10-04, A11Y-22). La bulle est un portail séparé de l'ancre par un
// espace de 8 px : quitter l'ancre fermait la bulle avant qu'on l'atteigne, et
// `pointer-events: none` interdisait de toute façon de la survoler.
// Désormais : quitter l'ancre ou la bulle ferme après un court délai, entrer
// sur l'une ou l'autre annule la fermeture. Un clic et Échap ferment tout de suite.

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
}

beforeEach(() => {
  mockMatchMedia(true) // un vrai pointeur : (hover: hover) and (pointer: fine)
  vi.useFakeTimers()
  localStorage.setItem('fridge-lang', 'fr')
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const laisserPasserLeDelai = () => act(() => { vi.advanceTimersByTime(1000) })

describe('Tooltip : la bulle se survole', () => {
  function ouvrir() {
    render(
      <Tooltip text="Aide & infos">
        <button type="button" aria-label="Aide">?</button>
      </Tooltip>,
    )
    const ancre = screen.getByRole('button', { name: 'Aide' })
    fireEvent.mouseEnter(ancre)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    return ancre
  }

  it('quitter l’ancre laisse la bulle un instant, puis la ferme', () => {
    const ancre = ouvrir()
    fireEvent.mouseLeave(ancre)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    laisserPasserLeDelai()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('entrer sur la bulle annule la fermeture ; la quitter la ferme', () => {
    const ancre = ouvrir()
    fireEvent.mouseLeave(ancre)
    fireEvent.mouseEnter(screen.getByRole('tooltip'))
    laisserPasserLeDelai()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.mouseLeave(screen.getByRole('tooltip'))
    laisserPasserLeDelai()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('la bulle reçoit le pointeur (plus de pointer-events: none)', () => {
    ouvrir()
    expect(screen.getByRole('tooltip')).not.toHaveStyle({ pointerEvents: 'none' })
  })

  it('un clic sur l’ancre ferme tout de suite, sans attendre le délai', () => {
    const ancre = ouvrir()
    fireEvent.click(ancre)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('Échap ferme tout de suite', () => {
    ouvrir()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})

describe('InfoTooltip : même règle pour la pastille « i »', () => {
  it('la bulle reste quand le pointeur passe de la pastille à la bulle', () => {
    render(<UIProvider><InfoTooltip text="Explication détaillée" /></UIProvider>)
    const pastille = screen.getByRole('button', { name: 'Informations' })
    fireEvent.mouseEnter(pastille)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.mouseLeave(pastille)
    fireEvent.mouseEnter(screen.getByRole('tooltip'))
    laisserPasserLeDelai()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.mouseLeave(screen.getByRole('tooltip'))
    laisserPasserLeDelai()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
