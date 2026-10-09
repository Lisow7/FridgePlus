import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { printReactElement } from '@shared/lib/print/print-element'

// L'impression ne fabrique plus de document HTML : elle rend un élément React
// dans une racine posée sur <body>, puis appelle `window.print()`.
//
// Ce que ces tests protègent (audit du 2026-10-04, SEC-01 et SEC-04) :
//  - l'ancienne fiche était une CHAÎNE HTML ouverte dans une fenêtre `blob:` de
//    même origine que l'app ; un champ non échappé y devenait du code ;
//  - elle comptait sur un `<script>` en ligne pour lancer l'impression, que la
//    CSP de production bloque : « Imprimer » n'imprimait plus.
describe('printReactElement', () => {
  let print
  let open

  beforeEach(() => {
    print = vi.fn()
    open = vi.fn()
    vi.stubGlobal('print', print)
    vi.stubGlobal('open', open)
  })

  afterEach(() => {
    // Rejoue la fin d'impression pour ne rien laisser au test suivant.
    window.dispatchEvent(new Event('afterprint'))
    vi.unstubAllGlobals()
  })

  it('rend le contenu dans une racine posée sur <body>, AVANT d’appeler window.print', () => {
    let contenuAuMomentDImprimer = null
    print.mockImplementation(() => {
      contenuAuMomentDImprimer = document.querySelector('.fp-print-root')?.textContent
    })
    printReactElement(<p>Salade Caprese</p>)
    expect(print).toHaveBeenCalledOnce()
    expect(contenuAuMomentDImprimer).toBe('Salade Caprese')
    expect(document.querySelector('.fp-print-root').parentElement).toBe(document.body)
  })

  it('signale l’impression sur <html> le temps qu’elle dure', () => {
    printReactElement(<p>Liste</p>)
    expect(document.documentElement.classList.contains('fp-printing')).toBe(true)
    window.dispatchEvent(new Event('afterprint'))
    expect(document.documentElement.classList.contains('fp-printing')).toBe(false)
  })

  it('retire la racine une fois l’impression terminée', () => {
    printReactElement(<p>Liste</p>)
    window.dispatchEvent(new Event('afterprint'))
    expect(document.querySelector('.fp-print-root')).toBeNull()
  })

  it('n’empile pas les racines si la fin d’impression n’est jamais signalée (mobile)', () => {
    printReactElement(<p>Première</p>)
    printReactElement(<p>Seconde</p>)
    const racines = document.querySelectorAll('.fp-print-root')
    expect(racines).toHaveLength(1)
    expect(racines[0].textContent).toBe('Seconde')
  })

  it('n’ouvre AUCUNE fenêtre et ne crée aucun document blob', () => {
    const createObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL })
    printReactElement(<p>Liste</p>)
    expect(open).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
