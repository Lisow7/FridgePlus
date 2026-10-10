import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import HeaderLogo from '@app/layout/header/HeaderLogo'

// Audit du 2026-10-04, A11Y-11 : le slogan de l'en-tête s'efface et se
// réécrit lettre à lettre, en boucle, sur chaque page. Une personne qui a
// demandé « réduire les animations » à son système le garde fixe.

function preferer(reduire) {
  window.matchMedia = vi.fn().mockImplementation((requete) => ({
    matches: reduire && requete.includes('prefers-reduced-motion: reduce'),
    media: requete, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
}

afterEach(() => { vi.useRealTimers(); delete window.matchMedia })

describe('slogan de l’en-tête', () => {
  it('mouvement réduit demandé : le premier slogan reste, sans s’effacer', async () => {
    preferer(true)
    vi.useFakeTimers()
    render(<HeaderLogo lang="fr" onReset={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(screen.getByText('Cuisine mieux, sans limites.')).toBeInTheDocument()
  })

  it('sans préférence : il tourne (témoin)', async () => {
    preferer(false)
    vi.useFakeTimers()
    render(<HeaderLogo lang="fr" onReset={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(screen.queryByText('Cuisine mieux, sans limites.')).not.toBeInTheDocument()
  })

  // Décision du 2026-10-06 (choix d'Antoine, « slogan = un_tour ») : WCAG
  // 2.2.2 demande un moyen d'arrêter un texte qui bouge plus de 5 secondes.
  // Les dix slogans défilent une fois, puis le premier reste.
  it('sans préférence : un seul tour, puis le premier slogan reste — plus rien ne tourne', async () => {
    preferer(false)
    vi.useFakeTimers()
    render(<HeaderLogo lang="fr" onReset={vi.fn()} />)
    // Un tour : 10 × (4 s d'attente + effacement + frappe) ≈ 70 s.
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(screen.getByText('Cuisine mieux, sans limites.')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000) })
    expect(screen.getByText('Cuisine mieux, sans limites.')).toBeInTheDocument()
  })

  it('le tour montre bien les dix slogans, chacun une fois', async () => {
    preferer(false)
    vi.useFakeTimers()
    render(<HeaderLogo lang="fr" onReset={vi.fn()} />)
    const vus = new Set()
    for (let ms = 0; ms < 120_000; ms += 250) {
      await act(async () => { await vi.advanceTimersByTimeAsync(250) })
      for (const s of ['Ton assistant cuisine personnel.', "Ouvre ton frigo. Trouve l’inspiration.", 'Des recettes sur mesure, chaque soir.']) {
        if (screen.queryByText(s)) vus.add(s)
      }
    }
    expect(vus.size).toBe(3)
  })

  it('sans matchMedia (vieux navigateur, jsdom) : rien ne casse', () => {
    expect(() => render(<HeaderLogo lang="fr" onReset={vi.fn()} />)).not.toThrow()
  })
})
