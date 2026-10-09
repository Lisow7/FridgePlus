import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UIProvider, useDarkMode } from '@shared/contexts/ui-provider'

// Garde-fou né d'un bug CONSTATÉ le 2026-08-24 : « le changement de thème n'est
// pas fluide ».
//
// Cause racine mesurée : les effets de bord (localStorage, `data-theme`,
// `document.startViewTransition`) vivaient DANS l'updater de `setDarkModeState`.
// Or un updater doit être PUR — React se réserve le droit de le rejouer, et
// `StrictMode` le fait systématiquement en développement.
//
// Symptôme observé sur UN SEUL clic, avant correction :
//   startViewTransition appelée 2 fois · `data-theme` posé 2 fois
//   « AbortError: Transition was skipped » → le fondu était INTERROMPU en plein
//   vol, ce qui se voyait à l'écran.
//
// 🔴 Ce test rend l'arbre sous `StrictMode` À DESSEIN : sans lui, l'updater
// n'est pas rejoué et le défaut reste invisible. C'est précisément la condition
// qui le révèle.

function Bouton() {
  const { toggleDarkMode } = useDarkMode()
  return <button onClick={toggleDarkMode}>basculer</button>
}

// ⚠️ `data-theme` est posé au FRAME SUIVANT, à dessein : la règle de transition
// doit être en place avant que les tokens changent, sinon les couleurs sautent
// au lieu de glisser. Les tests doivent donc laisser passer une image — sans
// cette attente ils dépendraient du hasard de l'ordonnancement.
const attendreUneImage = () =>
  act(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

describe('bascule de thème — les effets de bord ne partent QU UNE FOIS', () => {
  let poses

  beforeEach(() => {
    poses = []
    const vrai = document.documentElement.setAttribute.bind(document.documentElement)
    vi.spyOn(document.documentElement, 'setAttribute').mockImplementation((n, v) => {
      if (n === 'data-theme' || n === 'data-transition') poses.push(n)
      return vrai(n, v)
    })
    try { localStorage.clear() } catch { /* jsdom */ }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-transition')
  })

  it('un clic ne pose `data-theme` qu une seule fois, même sous StrictMode', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <UIProvider><Bouton /></UIProvider>
      </StrictMode>,
    )

    await act(async () => { await user.click(screen.getByRole('button', { name: 'basculer' })) })
    await attendreUneImage()

    const theme = poses.filter(p => p === 'data-theme')
    expect(theme, `« data-theme » posé ${theme.length} fois pour un seul clic — les effets de bord sont-ils repassés dans l updater de setState ?`).toHaveLength(1)
  })

  it('un clic n arme la transition qu une seule fois', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <UIProvider><Bouton /></UIProvider>
      </StrictMode>,
    )

    await act(async () => { await user.click(screen.getByRole('button', { name: 'basculer' })) })
    await attendreUneImage()

    const transition = poses.filter(p => p === 'data-transition')
    expect(transition, `« data-transition » posé ${transition.length} fois — une seconde transition annule la première (AbortError) et le fondu saute`).toHaveLength(1)
  })

  it('le thème bascule bien de clair à sombre', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <UIProvider><Bouton /></UIProvider>
      </StrictMode>,
    )

    await act(async () => { await user.click(screen.getByRole('button', { name: 'basculer' })) })
    await attendreUneImage()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('fridge-theme')).toBe('dark')
  })
})
