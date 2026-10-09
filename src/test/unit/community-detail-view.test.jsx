// Tests unit — DetailView (vue détail d'un post communauté), extraite de
// community-page.jsx (audit front §2). Le hook d'état (usePostDetail, testé
// à part) et les enfants sont mockés pour isoler le rendu et la dérivation
// laissée dans la vue (filtre des bloqués, racines/enfants).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const hookState = { current: null }
vi.mock('@features/community/hooks/use-post-detail', () => ({
  usePostDetail: () => hookState.current,
}))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@shared/lib/i18n/notifications-i18n', () => ({ formatRelativeTime: () => 'il y a 2 h' }))
vi.mock('@shared/lib/i18n/community-i18n', () => ({ categoryLabel: (_t, cat) => cat }))
vi.mock('@features/community/components/community-category-icon', () => ({ CategoryIcon: () => null }))
vi.mock('@features/community/components/community-feed-states', () => ({ LoadingState: () => <div>chargement</div> }))
vi.mock('@features/community/components/community-recipe-preview-card', () => ({ RecipePreviewCard: () => <div>recipe-preview</div> }))
vi.mock('@features/community/components/community-emoji-reaction-bar', () => ({ EmojiReactionBar: () => <div>reactions</div> }))
vi.mock('@features/community/components/community-reply-card', () => ({
  ReplyCard: ({ reply, replyToUsername }) => <div>{reply.body}{replyToUsername ? ` (↳ ${replyToUsername})` : ''}</div>,
}))

import { DetailView } from '@features/community/components/community-detail-view'

const t = {
  deletedAuthor: 'Supprimé', deletedToast: 'Post supprimé', edit: 'Éditer', delete: 'Supprimer',
  report: 'Signaler', replyEmpty: 'Aucune réponse', replyPh: 'Ta réponse…', loginToPost: 'Connecte-toi',
  repliesCount: (n) => `${n} réponses`, mutedBanner: 'Tu es muté', termsDeclinedBanner: 'Charte refusée',
  profileViewBtn: (a) => `Profil de ${a}`, replyToUser: (a) => `à ${a}`, replyToCancel: 'Annuler',
  sendReplyAria: 'Envoyer la réponse',
}
const post = { id: 'p1', user_id: 'u2', title: 'Mon post', body: 'Le contenu', category: 'general', likes_count: 2, replies_count: 1, created_at: '2026-07-26', profile: { username: 'bob' } }

function state(over = {}) {
  return {
    post, replies: [], likedReplyIds: new Set(),
    replyBody: '', setReplyBody: vi.fn(),
    replyToId: null, setReplyToId: vi.fn(),
    submitError: null, submitting: false,
    handleToggleReplyLike: vi.fn(), handleReactPost: vi.fn(),
    handleReplySubmit: vi.fn(), handleDeleteReply: vi.fn(),
    ...over,
  }
}

const base = {
  postId: 'p1', user: { id: 'u1' }, t, lang: 'fr', isMobile: false,
  reactionsMap: new Map(), onReact: vi.fn(), onDelete: vi.fn(), onEdit: vi.fn(), onReport: vi.fn(),
  muteStatus: { muted: false }, canInteract: true, isOwn: () => false, darkMode: false,
  recipeNames: new Map(), blockedUserIds: new Set(),
}

beforeEach(() => { hookState.current = state() })

describe('DetailView', () => {
  it('affiche le chargement tant que post ET replies sont null', () => {
    hookState.current = state({ post: null, replies: null })
    render(<DetailView {...base} />)
    expect(screen.getByText('chargement')).toBeInTheDocument()
  })

  it('affiche le message « post supprimé » quand le chargement a répondu sans post', () => {
    hookState.current = state({ post: null, replies: [] })
    render(<DetailView {...base} />)
    expect(screen.getByText('Post supprimé')).toBeInTheDocument()
    expect(screen.queryByText('chargement')).not.toBeInTheDocument()
  })

  it('affiche le post complet et l’état vide du fil', () => {
    render(<DetailView {...base} />)
    expect(screen.getByText('Mon post')).toBeInTheDocument()
    expect(screen.getByText('Le contenu')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByText('Aucune réponse')).toBeInTheDocument()
  })

  it('imbrique les réponses enfants sous leur racine avec la mention de l’auteur parent', () => {
    hookState.current = state({
      replies: [
        { id: 'r1', user_id: 'u3', body: 'Racine', profile: { username: 'alice' } },
        { id: 'r2', user_id: 'u4', body: 'Enfant', parent_reply_id: 'r1', profile: { username: 'carl' } },
      ],
    })
    render(<DetailView {...base} />)
    expect(screen.getByText('Racine')).toBeInTheDocument()
    expect(screen.getByText('Enfant (↳ alice)')).toBeInTheDocument()
  })

  it('filtre les réponses des utilisateurs bloqués', () => {
    hookState.current = state({
      replies: [
        { id: 'r1', user_id: 'u3', body: 'Visible', profile: { username: 'alice' } },
        { id: 'r2', user_id: 'u9', body: 'Bloquée', profile: { username: 'troll' } },
      ],
    })
    render(<DetailView {...base} blockedUserIds={new Set(['u9'])} />)
    expect(screen.getByText('Visible')).toBeInTheDocument()
    expect(screen.queryByText('Bloquée')).not.toBeInTheDocument()
  })

  it('composer : invite à se connecter sans user, avertit si muté', () => {
    const { unmount } = render(<DetailView {...base} user={null} />)
    expect(screen.getByText('Connecte-toi')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Ta réponse…')).not.toBeInTheDocument()
    unmount()

    render(<DetailView {...base} muteStatus={{ muted: true }} />)
    expect(screen.getByText(/Tu es muté/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Ta réponse…')).not.toBeInTheDocument()
  })

  it('composer disponible pour un membre autorisé', () => {
    render(<DetailView {...base} />)
    expect(screen.getByPlaceholderText('Ta réponse…')).toBeInTheDocument()
  })

  it('affiche éditer/supprimer sur son propre post, signaler sinon', () => {
    const { unmount } = render(<DetailView {...base} isOwn={() => true} />)
    expect(screen.getByText('Éditer')).toBeInTheDocument()
    expect(screen.getByText('Supprimer')).toBeInTheDocument()
    unmount()

    render(<DetailView {...base} isOwn={() => false} />)
    expect(screen.getByText('Signaler')).toBeInTheDocument()
  })

  // Régression i18n : ce libellé était écrit en anglais dans le JSX.
  it('le bouton d\'envoi de réponse prend son libellé dans t', () => {
    render(<DetailView {...base} />)
    expect(screen.getByRole('button', { name: 'Envoyer la réponse' })).toBeInTheDocument()
  })
})
