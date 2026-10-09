import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'

function Harness({ onClose }) {
  const [isOpen, setIsOpen] = useState(true)
  useCloseOnBackButton(isOpen, () => { setIsOpen(false); onClose?.() })
  return <div>{isOpen ? 'open' : 'closed'}</div>
}

function isOwnToken(state) {
  return typeof state?.fpModalBack === 'number'
}

// Un vrai « retour » QUITTE l'entrée courante avant le popstate : l'état lu
// ensuite n'est plus notre jeton. On le simule fidèlement (avant 2026-10-02, ce
// helper émettait le popstate en restant sur la sentinelle — un cas qui
// n'existe pas, et que la garde « c'est notre propre entrée » ignore à raison).
function pop() {
  act(() => {
    window.history.replaceState(null, '')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

describe('useCloseOnBackButton', () => {
  it('pousse une entrée d\'historique à l\'ouverture', () => {
    render(<Harness />)
    expect(isOwnToken(window.history.state)).toBe(true)
  })

  it('un popstate (bouton retour) ferme la modale au lieu de naviguer', () => {
    const onClose = vi.fn()
    const { getByText } = render(<Harness onClose={onClose} />)
    expect(getByText('open')).toBeInTheDocument()

    pop()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(getByText('closed')).toBeInTheDocument()
  })

  it('une fermeture par un autre biais (X, backdrop) consomme l\'entrée poussée (pas de retour fantôme)', async () => {
    const { unmount } = render(<Harness />)
    const pushedToken = window.history.state?.fpModalBack
    expect(typeof pushedToken).toBe('number')

    // history.back() est asynchrone (même en vrai navigateur), et jsdom peut
    // prendre plus d'un tick pour la traiter — attendre le popstate réel de
    // cette navigation plutôt qu'un délai arbitraire.
    const backHappened = new Promise(resolve => {
      window.addEventListener('popstate', resolve, { once: true })
    })
    await act(async () => {
      unmount()
      await backHappened
    })

    // De retour à l'état d'avant l'ouverture — pas resté coincé sur l'entrée
    // poussée (ce qui ferait qu'un futur retour matériel ne ferait plus rien).
    expect(window.history.state?.fpModalBack).not.toBe(pushedToken)
  })

  it('survit au double-invoke des effets de StrictMode (dev) sans se fermer tout seul', async () => {
    // Régression trouvée en e2e réel (2026-07-11) : StrictMode
    // mount->cleanup->remount synchrone + un history.back() naïf dans le
    // cleanup produisait un popstate différé qui fermait la modale
    // immédiatement après son ouverture, avant même que le test/utilisateur
    // n'ait pu interagir.
    const onClose = vi.fn()
    const { getByText } = render(
      <StrictMode><Harness onClose={onClose} /></StrictMode>,
    )
    expect(getByText('open')).toBeInTheDocument()

    // Laisse le setTimeout(0) du cleanup (double-invoke) s'exécuter.
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    expect(onClose).not.toHaveBeenCalled()
    expect(getByText('open')).toBeInTheDocument()
    expect(isOwnToken(window.history.state)).toBe(true)
  })

  it('une modale qui en remplace une autre dans le même rendu ne se fait pas fermer par le cleanup de l\'ancienne', async () => {
    // Régression trouvée en usage réel (2026-07-11) : help-guide.jsx ferme
    // son modal ET ouvre TourWizard dans le même clic ("Visite guidée").
    // Avec un simple booléen partagé comme marqueur, le cleanup de la modale
    // qui se ferme voyait l'entrée fraîchement poussée par la nouvelle
    // modale, la confondait avec la sienne, et la dépilait par erreur —
    // fermant la modale qui venait tout juste de s'ouvrir.
    const onCloseA = vi.fn()
    const onCloseB = vi.fn()

    function Outer() {
      // Modale A ouverte, puis remplacée par la modale B dans le même clic
      // (même render) — le motif qui a produit le bug de 2026-07-11, alors sur
      // l'enchaînement HelpGuide -> TourWizard (aujourd'hui remplacé par une
      // navigation vers `/guide`). Le motif, lui, reste courant.
      const [which, setWhich] = useState('a')
      useCloseOnBackButton(which === 'a', onCloseA)
      useCloseOnBackButton(which === 'b', onCloseB)
      return (
        <div>
          <span>{which}</span>
          <button onClick={() => setWhich('b')}>switch</button>
        </div>
      )
    }

    const { getByText } = render(<Outer />)
    expect(getByText('a')).toBeInTheDocument()

    act(() => { getByText('switch').click() })
    expect(getByText('b')).toBeInTheDocument()

    // Laisse le setTimeout(0) du cleanup de la modale A s'exécuter.
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    // La modale B doit toujours être "ouverte" (son onClose pas appelé) —
    // le cleanup de A ne doit pas avoir dépilé l'entrée de B par erreur.
    expect(onCloseB).not.toHaveBeenCalled()
    expect(onCloseA).not.toHaveBeenCalled()
    expect(getByText('b')).toBeInTheDocument()
  })

  // Audit 2026-10-02 : Échap dans le tiroir des filtres fermait AUSSI le
  // panneau Recettes. Le tiroir, fermé autrement que par « retour », dépile sa
  // sentinelle : le popstate qui suit atterrit sur la sentinelle du PANNEAU —
  // ce n'est pas un retour qui le vise, il doit rester ouvert.
  it('fermer la modale du dessus autrement que par « retour » ne ferme pas celle du dessous', async () => {
    function Inner({ onClose }) {
      useCloseOnBackButton(true, onClose)
      return <span>inner-open</span>
    }
    function Imbriquees({ onOuterClose }) {
      const [outer, setOuter] = useState(true)
      const [inner, setInner] = useState(false)
      useCloseOnBackButton(outer, () => { setOuter(false); onOuterClose() })
      return (
        <div>
          {outer ? 'outer-open' : 'outer-closed'}
          {inner && <Inner onClose={() => setInner(false)} />}
          <button onClick={() => setInner(true)}>ouvrir-inner</button>
          <button onClick={() => setInner(false)}>fermer-inner</button>
        </div>
      )
    }
    const onOuterClose = vi.fn()
    const { getByText, queryByText } = render(<Imbriquees onOuterClose={onOuterClose} />)
    // Le tiroir s'ouvre APRÈS le panneau, comme dans l'app (un enfant monté en
    // même temps que son parent empilerait sa sentinelle en dessous)
    act(() => { getByText('ouvrir-inner').click() })
    expect(getByText('inner-open')).toBeInTheDocument()
    const backHappened = new Promise(resolve => {
      window.addEventListener('popstate', resolve, { once: true })
    })
    await act(async () => {
      getByText('fermer-inner').click()
      await backHappened
    })
    expect(queryByText('inner-open')).toBeNull()
    expect(getByText('outer-open')).toBeInTheDocument()
    expect(onOuterClose).not.toHaveBeenCalled()
  })

  it('ne pousse rien si la modale ne s\'ouvre jamais (isOpen=false dès le départ)', () => {
    function ClosedHarness() {
      useCloseOnBackButton(false, vi.fn())
      return <div>never open</div>
    }
    const stateBefore = window.history.state
    render(<ClosedHarness />)
    expect(window.history.state).toEqual(stateBefore)
  })
})
