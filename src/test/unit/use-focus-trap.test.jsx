import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRef, useState } from 'react'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'

// Régression : la saisie du code MFA perdait le focus à chaque frappe car
// `onEscape` (recréé à chaque render du parent, ex. `function handleCancel()`
// inline) était dans les deps de l'effet → relance → re-focus du 1er élément
// focusable (la croix). Le hook doit : (1) ne pas voler le focus à un enfant
// déjà focalisé (autoFocus), (2) ne PAS se relancer sur changement d'identité
// de onEscape, (3) toujours appeler la dernière version de onEscape.

function Harness({ onEscape }) {
  const ref = useRef(null)
  const [value, setValue] = useState('')
  // onEscape volontairement recréé à chaque render (reproduit le cas réel).
  useFocusTrap(ref, { active: true, onEscape: () => onEscape?.() })
  return (
    <div ref={ref} role="dialog">
      {/* La croix vient AVANT l'input dans l'ordre DOM (comme la vraie modale). */}
      <button type="button" aria-label="Close">X</button>
      <input
        aria-label="code"
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
      />
    </div>
  )
}

describe('useFocusTrap', () => {
  it("garde le focus sur l'input autoFocus après chaque frappe (pas de vol vers la croix)", () => {
    render(<Harness />)
    const input = screen.getByLabelText('code')

    // À l'ouverture : autoFocus + garde → le focus reste sur l'input.
    expect(document.activeElement).toBe(input)

    // Frappe → re-render → onEscape recréé → l'effet ne doit pas se relancer
    // ni voler le focus.
    fireEvent.change(input, { target: { value: '1' } })
    expect(document.activeElement).toBe(input)

    fireEvent.change(input, { target: { value: '12' } })
    expect(document.activeElement).toBe(input)
  })

  it('Escape appelle la dernière version de onEscape', () => {
    const onEscape = vi.fn()
    render(<Harness onEscape={onEscape} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  // Régression (audit clavier 2026-08-25) : l'écouteur vivait sur le CONTAINER.
  // Quand le focus s'échappait — élément focalisé démonté (le navigateur ne
  // dispatch alors AUCUN événement focus), retour depuis la barre d'URL — la
  // modale ne recevait plus ni Tab ni Escape : piège mort, utilisateur clavier
  // coincé devant un dialogue qui ne répond plus. L'écouteur doit vivre sur
  // `document`, et Tab depuis l'extérieur doit RAMENER le focus dedans.
  it('Escape fonctionne même quand le focus est tombé sur <body>', () => {
    const onEscape = vi.fn()
    render(<Harness onEscape={onEscape} />)
    document.activeElement.blur()
    expect(document.activeElement).toBe(document.body)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('Tab depuis <body> ramène le focus dans la modale', () => {
    render(<Harness />)
    document.activeElement.blur()
    expect(document.activeElement).toBe(document.body)
    fireEvent.keyDown(document.body, { key: 'Tab' })
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  // Deux pièges ACTIFS empilés (cas réel : ConfirmModal par-dessus RecipeModal,
  // tous deux `active: true`). Avec des écouteurs `document`, les deux
  // recevraient chaque touche : un seul Escape fermerait LES DEUX modales.
  // Seul le piège du SOMMET de la pile doit agir.
  it('avec deux pièges actifs empilés, Escape ne touche que celui du dessus', () => {
    const escParent = vi.fn()
    const escChild = vi.fn()
    function Pile() {
      const parentRef = useRef(null)
      const childRef = useRef(null)
      useFocusTrap(parentRef, { active: true, onEscape: escParent })
      useFocusTrap(childRef, { active: true, onEscape: escChild })
      return (
        <div ref={parentRef} role="dialog" aria-label="parent">
          <button type="button">action parent</button>
          <div ref={childRef} role="dialog" aria-label="enfant">
            <button type="button">action enfant</button>
          </div>
        </div>
      )
    }
    render(<Pile />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(escChild).toHaveBeenCalledTimes(1)
    expect(escParent).not.toHaveBeenCalled()
  })
})
