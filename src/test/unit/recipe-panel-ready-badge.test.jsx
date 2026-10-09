import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReadyBadgeDot } from '@features/recipes/components/ready-badge-dot'
import { shouldShowReadyBadge } from '@features/recipes/lib/ready-badge'

describe('ReadyBadgeDot', () => {
  it('rend le point quand show=true', () => {
    render(<ReadyBadgeDot show={true} />)
    expect(screen.getByTestId('ready-badge-dot')).toBeInTheDocument()
  })

  it('ne rend rien quand show=false', () => {
    render(<ReadyBadgeDot show={false} />)
    expect(screen.queryByTestId('ready-badge-dot')).not.toBeInTheDocument()
  })

  it('le point est décoratif (aria-hidden) — le compteur reste la seule info accessible', () => {
    render(<ReadyBadgeDot show={true} />)
    expect(screen.getByTestId('ready-badge-dot')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('shouldShowReadyBadge', () => {
  it('affiche le point quand readyCount > 0 et filter !== "ready"', () => {
    expect(shouldShowReadyBadge(3, 'all')).toBe(true)
  })

  it('cache le point quand readyCount === 0, quel que soit filter', () => {
    expect(shouldShowReadyBadge(0, 'all')).toBe(false)
    expect(shouldShowReadyBadge(0, 'almost')).toBe(false)
  })

  it('cache le point quand filter === "ready" même avec readyCount > 0', () => {
    expect(shouldShowReadyBadge(5, 'ready')).toBe(false)
  })

  it('réagit à un changement de readyCount (0 → 1) sans action supplémentaire', () => {
    expect(shouldShowReadyBadge(0, 'all')).toBe(false)
    expect(shouldShowReadyBadge(1, 'all')).toBe(true)
  })
})
