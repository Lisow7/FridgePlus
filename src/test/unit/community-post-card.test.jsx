// Tests unit — PostCard (composeur du feed communauté), extrait de
// community-page.jsx (audit front §2). On mocke les enfants (déjà testés
// ailleurs) et l'i18n pour isoler le rendu propre de PostCard.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@shared/lib/i18n/notifications-i18n', () => ({ formatRelativeTime: () => 'il y a 2 h' }))
vi.mock('@shared/lib/i18n/community-i18n', () => ({ categoryLabel: (_t, cat) => cat }))
vi.mock('@features/community/components/community-category-icon', () => ({ CategoryIcon: () => null }))
vi.mock('@features/community/components/community-recipe-preview-card', () => ({ RecipePreviewCard: () => <div>recipe-preview</div> }))
vi.mock('@features/community/components/community-emoji-reaction-bar', () => ({ EmojiReactionBar: () => <div>reactions</div> }))

import { PostCard } from '@features/community/components/community-post-card'

const t = { deletedAuthor: 'Supprimé', edit: 'Éditer', delete: 'Supprimer', report: 'Signaler', profileViewBtn: (a) => `Profil de ${a}` }
const post = { category: 'general', title: 'Mon post', body: 'Le contenu', profile: { username: 'bob' }, created_at: '2026-07-25', likes_count: 3, replies_count: 2, user_id: 'u1' }
const base = { post, idx: 0, t, lang: 'fr', darkMode: false, onReact: () => {}, canLike: true }

describe('PostCard', () => {
  it('affiche titre, corps et auteur', () => {
    render(<PostCard {...base} onOpen={() => {}} isOwn={false} canReport={false} />)
    expect(screen.getByText('Mon post')).toBeInTheDocument()
    expect(screen.getByText('Le contenu')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
  })

  it('clic sur la carte appelle onOpen', () => {
    const onOpen = vi.fn()
    render(<PostCard {...base} onOpen={onOpen} isOwn={false} canReport={false} />)
    fireEvent.click(screen.getByText('Mon post'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('affiche éditer/supprimer si isOwn', () => {
    render(<PostCard {...base} onOpen={() => {}} isOwn onEdit={() => {}} onDelete={() => {}} canReport={false} />)
    expect(screen.getByRole('button', { name: 'Éditer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('affiche signaler si non-propriétaire et canReport', () => {
    render(<PostCard {...base} onOpen={() => {}} isOwn={false} canReport onReport={() => {}} />)
    expect(screen.getByRole('button', { name: 'Signaler' })).toBeInTheDocument()
  })
})
