// Tests unit — ReplyCard (feuille du fil de réponses), extraite de
// community-page.jsx (audit front §2). Avatar et i18n de date mockés pour
// isoler le rendu propre de la carte.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@shared/lib/i18n/notifications-i18n', () => ({ formatRelativeTime: () => 'il y a 2 h' }))

import { ReplyCard } from '@features/community/components/community-reply-card'

const t = {
  deletedAuthor: 'Supprimé', delete: 'Supprimer', report: 'Signaler',
  replyToBtn: 'Répondre', profileViewBtn: (a) => `Profil de ${a}`,
}
const reply = { id: 'r1', user_id: 'u1', body: 'Ma réponse', likes_count: 4, created_at: '2026-07-25', profile: { username: 'bob' } }
const base = { reply, t, lang: 'fr', darkMode: false }

describe('ReplyCard', () => {
  it('affiche auteur, corps et compteur de likes', () => {
    render(<ReplyCard {...base} isOwn={false} canReport={false} canLike={false} liked={false} />)
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByText('Ma réponse')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('affiche supprimer si isOwn, signaler sinon', () => {
    const { unmount } = render(<ReplyCard {...base} isOwn canReport onDelete={() => {}} />)
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Signaler' })).not.toBeInTheDocument()
    unmount()

    render(<ReplyCard {...base} isOwn={false} canReport onReport={() => {}} />)
    expect(screen.getByRole('button', { name: 'Signaler' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })

  it('le like appelle onToggleLike et reste inerte si canLike est faux', () => {
    const onToggleLike = vi.fn()
    const { unmount } = render(<ReplyCard {...base} isOwn={false} canReport={false} canLike liked onToggleLike={onToggleLike} />)
    const likeBtn = screen.getByRole('button', { pressed: true })
    fireEvent.click(likeBtn)
    expect(onToggleLike).toHaveBeenCalledTimes(1)
    unmount()

    render(<ReplyCard {...base} isOwn={false} canReport={false} canLike={false} liked={false} onToggleLike={onToggleLike} />)
    expect(screen.getByRole('button', { pressed: false })).toBeDisabled()
    expect(onToggleLike).toHaveBeenCalledTimes(1)
  })

  it('affiche la mention ↳ @auteur et le bouton Répondre quand ils sont fournis', () => {
    const onReplyTo = vi.fn()
    render(<ReplyCard {...base} isOwn={false} canReport={false} replyToUsername="alice" canReplyTo onReplyTo={onReplyTo} />)
    expect(screen.getByText('↳ @alice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Répondre' }))
    expect(onReplyTo).toHaveBeenCalled()
  })
})
