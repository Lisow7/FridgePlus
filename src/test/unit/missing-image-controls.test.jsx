import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MissingImageControls, MissingImageBadge } from '@features/admin/components/MissingImageControls'

describe('MissingImageControls', () => {
  it('affiche le compteur (FR)', () => {
    render(<MissingImageControls count={3} active={false} onToggle={() => {}} lang="fr" />)
    expect(screen.getByText(/3 sans image/i)).toBeInTheDocument()
  })
  it('toggle : onToggle appelé + aria-pressed', async () => {
    const onToggle = vi.fn(); const user = userEvent.setup()
    render(<MissingImageControls count={3} active onToggle={onToggle} lang="fr" />)
    const btn = screen.getByRole('button', { name: /sans image uniquement/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    await user.click(btn)
    expect(onToggle).toHaveBeenCalledOnce()
  })
  it('count=0 → pas de compteur affiché', () => {
    render(<MissingImageControls count={0} active={false} onToggle={() => {}} lang="fr" />)
    expect(screen.queryByText(/sans image$/i)).toBeNull()
  })
})

describe('MissingImageBadge', () => {
  it('rend le libellé FR / EN', () => {
    const { rerender } = render(<MissingImageBadge lang="fr" />)
    expect(screen.getByText('Sans image')).toBeInTheDocument()
    rerender(<MissingImageBadge lang="en" />)
    expect(screen.getByText('No image')).toBeInTheDocument()
  })
})
