import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import AnnonceDePage from '@app/components/annonce-de-page'

// Audit du 2026-10-04, A11Y-16 — le dernier point que la page « Accessibilité »
// disait ouvert : au changement de page, le focus du clavier restait sur un lien
// disparu (donc sur <body>), et un lecteur d'écran n'entendait rien. Désormais :
// le titre de la nouvelle page est annoncé, et le focus revient au début du
// contenu — sauf si la page l'a déjà pris elle-même (une fenêtre, un champ).

function Page({ titre, children }) {
  useEffect(() => { document.title = titre }, [titre])
  return <h1>{children ?? titre}</h1>
}

function Fenetre() {
  useEffect(() => { document.title = 'Une recette — Fridge+' }, [])
  return (
    <div role="dialog" aria-label="Une recette">
      <button type="button" autoFocus>Fermer</button>
    </div>
  )
}

function Liens() {
  const aller = useNavigate()
  return (
    <nav>
      <button type="button" onClick={() => aller('/b')}>vers B</button>
      <button type="button" onClick={() => aller('/c')}>vers C</button>
      <button type="button" onClick={() => aller('/b?onglet=2#bas')}>B avec recherche</button>
    </nav>
  )
}

function monter() {
  return render(
    <MemoryRouter initialEntries={['/a']}>
      <AnnonceDePage />
      <Liens />
      <main id="contenu-principal" tabIndex={-1}>
        <Routes>
          <Route path="/a" element={<Page titre="Page A — Fridge+" />} />
          <Route path="/b" element={<Page titre="Page B — Fridge+" />} />
          <Route path="/c" element={<Fenetre />} />
        </Routes>
      </main>
    </MemoryRouter>,
  )
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('au changement de page', () => {
  it('au premier affichage, rien n’est annoncé et le focus ne bouge pas', async () => {
    monter()
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(document.getElementById('annonce-de-page')).toHaveTextContent('')
    expect(document.activeElement).toBe(document.body)
  })

  it('le titre de la nouvelle page est annoncé, et le focus revient au début du contenu', async () => {
    monter()
    const lien = screen.getByRole('button', { name: 'vers B' })
    lien.focus()
    fireEvent.click(lien)
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(document.getElementById('annonce-de-page')).toHaveTextContent('Page B — Fridge+')
    expect(document.activeElement).toBe(document.getElementById('contenu-principal'))
  })

  it('une page qui prend le focus elle-même (une fenêtre) le garde', async () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'vers C' }))
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(document.getElementById('annonce-de-page')).toHaveTextContent('Une recette — Fridge+')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }))
  })

  it('une recherche ou une ancre ne sont pas un changement de page', async () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'vers B' }))
    await act(async () => { vi.advanceTimersByTime(2000) })
    const recherche = screen.getByRole('button', { name: 'B avec recherche' })
    recherche.focus()
    fireEvent.click(recherche)
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(document.activeElement).toBe(recherche)
  })
})
