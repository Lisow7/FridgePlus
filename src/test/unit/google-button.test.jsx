import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GoogleButton from '@shared/ui/google-button'

describe('GoogleButton', () => {
  it('rend le label et appelle onClick', () => {
    const onClick = vi.fn()
    render(<GoogleButton label="Continuer avec Google" onClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'Continuer avec Google' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('est désactivé en loading', () => {
    render(<GoogleButton label="Continuer avec Google" loading onClick={() => {}} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
