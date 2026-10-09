import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmDeleteModal, ConfirmActionModal } from '@shared/ui/confirm-dialog/confirm-modals'
import { Z_INDEX } from '@shared/lib/z-index'

describe('ConfirmDeleteModal / ConfirmActionModal', () => {
  it('ConfirmDeleteModal sans body ne rend pas de <p>', () => {
    render(
      <ConfirmDeleteModal
        title="Vider la liste ?"
        confirmLabel="Vider"
        cancelLabel="Annuler"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Vider la liste ?')).toBeInTheDocument()
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })

  it('ConfirmActionModal avec body rend le body', () => {
    render(
      <ConfirmActionModal
        title="Débannir cet utilisateur ?"
        body="Marie_92 pourra à nouveau se connecter."
        confirmLabel="Débannir"
        cancelLabel="Annuler"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Marie_92 pourra à nouveau se connecter.')).toBeInTheDocument()
  })

  it('applique Z_INDEX.CONFIRM à l\'overlay', () => {
    render(
      <ConfirmDeleteModal
        title="T"
        confirmLabel="C"
        cancelLabel="A"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const overlay = screen.getByRole('dialog')
    expect(overlay.getAttribute('style')).toMatch(new RegExp(`z-index:\\s*${Z_INDEX.CONFIRM}`))
  })
})
