import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CountBadge from '@shared/ui/count-badge'

describe('CountBadge', () => {
  it('ne rend rien quand count <= 0', () => {
    const { container } = render(<CountBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('affiche le nombre quand count > 0', () => {
    render(<CountBadge count={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })
  it('plafonne à 99+ au-delà de max', () => {
    render(<CountBadge count={150} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })
  it('respecte un max personnalisé', () => {
    render(<CountBadge count={12} max={9} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })
})
