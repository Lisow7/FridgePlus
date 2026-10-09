import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { useDropdownMenu } from '@shared/hooks/use-dropdown-menu'

function Harness() {
  const triggerRef = useRef(null)
  const { open, setOpen, menuRef } = useDropdownMenu(triggerRef)
  return (
    <div>
      <button ref={triggerRef} onClick={() => setOpen(v => !v)}>trigger</button>
      {open && <div ref={menuRef} role="menu">contenu</div>}
      <button>dehors</button>
    </div>
  )
}

describe('useDropdownMenu', () => {
  it('ouvre/ferme via setOpen', () => {
    render(<Harness />)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('ferme au clic extérieur', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('dehors'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('ferme sur Escape', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('trigger'))
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

// Motif WAI-ARIA « menu button » : une fois le menu ouvert, ↑/↓ circulent
// entre les entrées, Début/Fin sautent aux extrémités. Jusqu'au 2026-09-11
// seuls Tab et Escape fonctionnaient — un lecteur d'écran annonce « menu »
// et l'utilisateur attend les flèches.
function MenuDeTest() {
  const triggerRef = useRef(null)
  const { open, setOpen, menuRef } = useDropdownMenu(triggerRef)
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open}>Ouvrir</button>
      {open && (
        <div ref={menuRef} role="menu" aria-label="Test">
          <button role="menuitem">Un</button>
          <button role="menuitem" disabled>Deux (désactivé)</button>
          <button role="menuitem">Trois</button>
        </div>
      )}
    </>
  )
}

describe('useDropdownMenu — flèches', () => {
  it('↓ passe à l’entrée suivante en sautant les désactivées, ↑ revient, et ça boucle', async () => {
    const user = userEvent.setup()
    render(<MenuDeTest />)
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(screen.getByRole('menuitem', { name: 'Un' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Trois' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Un' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Trois' })).toHaveFocus()
  })

  it('Début et Fin vont aux extrémités', async () => {
    const user = userEvent.setup()
    render(<MenuDeTest />)
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Trois' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Un' })).toHaveFocus()
  })
})
