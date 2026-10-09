// Tests unit — FeedContent (composeur du feed), extrait de community-page.jsx
// (audit front §2). Enfants + i18n mockés pour isoler la logique de branchement.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@shared/lib/i18n/community-i18n', () => ({ CATEGORIES: ['general'], categoryLabel: (_t, c) => c }))
vi.mock('@features/community/components/community-category-icon', () => ({ CategoryIcon: () => null }))
vi.mock('@features/community/components/community-trending-card', () => ({ TrendingCard: () => null }))
vi.mock('@features/community/components/community-feed-states', () => ({ LoadingState: () => <div>loading</div>, EmptyState: () => <div>empty</div> }))
vi.mock('@features/community/components/community-post-card', () => ({ PostCard: ({ post }) => <div>post-{post.id}</div> }))

import { FeedContent } from '@features/community/components/community-feed-content'

const t = { catAll: 'Tous', feedRecent: 'Récents', feedPopular: 'Populaires' }
const base = {
  trending: [], reactionsMap: new Map(), category: 'all', setCategory: () => {}, sort: 'recent', setSort: () => {},
  search: '', onOpenPost: () => {}, onReact: () => {}, onEdit: () => {}, onDelete: () => {}, onReport: () => {},
  isOwn: () => false, canInteract: true, muteStatus: null, t, lang: 'fr', isMobile: false, darkMode: false,
  recipeNames: {}, onShowRecipe: () => {}, onShowProfile: () => {},
}

describe('FeedContent', () => {
  it('posts=null → affiche LoadingState', () => {
    render(<FeedContent {...base} posts={null} />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('posts=[] → affiche EmptyState', () => {
    render(<FeedContent {...base} posts={[]} />)
    expect(screen.getByText('empty')).toBeInTheDocument()
  })

  it('posts non vide → un PostCard par post', () => {
    render(<FeedContent {...base} posts={[{ id: 'p1' }, { id: 'p2' }]} />)
    expect(screen.getByText('post-p1')).toBeInTheDocument()
    expect(screen.getByText('post-p2')).toBeInTheDocument()
  })

  it('affiche les boutons de tri', () => {
    render(<FeedContent {...base} posts={[]} />)
    expect(screen.getByText('Récents')).toBeInTheDocument()
    expect(screen.getByText('Populaires')).toBeInTheDocument()
  })
})
