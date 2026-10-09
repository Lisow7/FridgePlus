import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Une touche sur un bouton DANS un conteneur cliquable ne déclenche pas le
// conteneur (audit du 2026-10-04, A11Y-04).
//
// Le post de la communauté et la ligne de notification sont des `role="button"`
// qui écoutent Entrée et Espace, avec `preventDefault()`. Le `keydown` d'un
// bouton interne remontait jusqu'à eux : l'action de la ligne partait À LA
// PLACE de celle du bouton (Entrée sur « Supprimer » ouvrait le post ou la
// notification, et l'activation native du bouton était annulée).

vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@shared/lib/i18n/notifications-i18n', async (importOriginal) => ({ ...(await importOriginal()), formatRelativeTime: () => 'il y a 2 h' }))
vi.mock('@shared/lib/i18n/community-i18n', () => ({ categoryLabel: (_t, cat) => cat }))
vi.mock('@features/community/components/community-category-icon', () => ({ CategoryIcon: () => null }))
vi.mock('@features/community/components/community-recipe-preview-card', () => ({ RecipePreviewCard: () => null }))
vi.mock('@features/community/components/community-emoji-reaction-bar', () => ({ EmojiReactionBar: () => null }))

import { PostCard } from '@features/community/components/community-post-card'
import { NotifItem } from '@features/notifications/components/notifications-panel'

describe('post de la communauté au clavier', () => {
  const t = { deletedAuthor: 'Supprimé', authorUnavailable: 'Auteur non chargé', edit: 'Éditer', delete: 'Supprimer', report: 'Signaler', profileViewBtn: (a) => `Profil de ${a}` }
  const post = { category: 'general', title: 'Mon post', body: 'Le contenu', profile: { username: 'bob' }, created_at: '2026-07-25', likes_count: 3, replies_count: 2, user_id: 'u1' }

  it('Entrée sur « Supprimer » n’ouvre pas le post', () => {
    const onOpen = vi.fn()
    render(<PostCard post={post} idx={0} t={t} lang="fr" darkMode={false} onReact={() => {}} canLike
      onOpen={onOpen} isOwn onEdit={() => {}} onDelete={() => {}} canReport={false} />)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Supprimer' }), { key: 'Enter' })

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('Entrée sur le post lui-même l’ouvre toujours', () => {
    const onOpen = vi.fn()
    render(<PostCard post={post} idx={0} t={t} lang="fr" darkMode={false} onReact={() => {}} canLike
      onOpen={onOpen} isOwn={false} canReport={false} />)

    fireEvent.keyDown(screen.getByText('Mon post').closest('article'), { key: 'Enter' })

    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('ligne de notification au clavier', () => {
  const t = { markOneRead: 'Marquer comme lu', deleteOne: 'Supprimer', seeMore: 'Voir plus', seeLess: 'Voir moins' }
  const n = { id: 'n-1', type: 'ticket_reply', title: { fr: 'Réponse du support' }, body: { fr: 'Bonjour.' }, read_at: null, created_at: '2026-08-02T00:00:00Z' }

  function monter() {
    const onClick = vi.fn()
    render(<NotifItem n={n} lang="fr" darkMode={false} fg="#000" muted="#666" border="#eee" t={t}
      onClick={onClick} onMarkRead={() => {}} onDelete={() => {}} />)
    return onClick
  }

  it('Entrée sur « Supprimer » ne fait pas suivre la notification', () => {
    const onClick = monter()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Supprimer' }), { key: 'Enter' })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('Entrée sur la ligne elle-même la suit toujours', () => {
    const onClick = monter()
    fireEvent.keyDown(screen.getByText('Réponse du support').closest('[role="button"]'), { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
