// Tests unit — feuilles présentationnelles extraites de community-page.jsx
// (audit front §2) : TrendingCard, LoadingState, EmptyState.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/lib/i18n/community-i18n', () => ({ categoryLabel: (_t, cat) => cat }))

import { TrendingCard } from '@features/community/components/community-trending-card'
import { LoadingState, EmptyState } from '@features/community/components/community-feed-states'

describe('community — feuilles', () => {
  it('TrendingCard affiche titre, rang et likes', () => {
    render(
      <TrendingCard
        post={{ category: 'general', title: 'Mon super post', likes_count: 42 }}
        rank={1}
        onClick={() => {}}
        t={{}}
        darkMode={false}
      />
    )
    expect(screen.getByText('Mon super post')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('LoadingState affiche 3 squelettes', () => {
    const { container } = render(<LoadingState darkMode={false} />)
    expect(container.querySelectorAll('div')).toHaveLength(3)
  })

  it('EmptyState affiche le message de feed vide', () => {
    render(<EmptyState t={{ emptyFeed: 'Aucun post pour le moment' }} darkMode={false} />)
    expect(screen.getByText('Aucun post pour le moment')).toBeInTheDocument()
  })
})
