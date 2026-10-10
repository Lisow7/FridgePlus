import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ComposeModal } from '@features/community/components/community-compose-modal'

const { mockCreatePost, mockUpdatePost, mockCanPost, mockModerate } = vi.hoisted(() => ({
  mockCreatePost: vi.fn(),
  mockUpdatePost: vi.fn(),
  mockCanPost: vi.fn(),
  mockModerate: vi.fn(),
}))
vi.mock('@shared/api/community', () => ({
  listPosts: vi.fn(), getPost: vi.fn(), deletePost: vi.fn(),
  createPost: (...args) => mockCreatePost(...args),
  updatePost: (...args) => mockUpdatePost(...args),
  listReplies: vi.fn(), createReply: vi.fn(), deleteReply: vi.fn(),
  listMyPostReactions: vi.fn(), reactToPost: vi.fn(), removePostReaction: vi.fn(),
  listMyLikedReplyIds: vi.fn(), likeReply: vi.fn(), unlikeReply: vi.fn(),
  canPost: (...args) => mockCanPost(...args), canReply: vi.fn(), getMyMuteStatus: vi.fn(),
  getCommunityTermsAcceptedAt: vi.fn(), acceptCommunityTerms: vi.fn(),
  listMyBlockedUserIds: vi.fn(), listAttachableRecipes: vi.fn(), getRecipeNamesByIds: vi.fn(),
}))
vi.mock('@shared/api/moderation-de-contenu', () => ({
  moderateContent: (...args) => mockModerate(...args),
}))

const T = {
  composeTitle: 'Nouveau post', composeEditTitle: 'Modifier le post',
  fieldCategory: 'Catégorie', fieldTitle: 'Titre', fieldTitlePh: 'Titre du post',
  fieldBody: 'Message', fieldBodyPh: 'Ton message…',
  titleTooShort: 'trop court', titleTooLong: (n) => `titre trop long (${n})`,
  bodyTooShort: 'message trop court', bodyTooLong: (n) => `message trop long (${n})`,
  profanityWarning: 'profanité', spamLimitPost: 'limite atteinte',
  cancel: 'Annuler', submit: 'Publier', submitEdit: 'Mettre à jour',
  contentBlocked: 'Bloqué par la modération.', moderationError: 'Vérification impossible, réessaie.',
  closeAria: 'Fermer', removeRecipeAria: 'Retirer la recette',
}

const baseProps = {
  initialPost: null, initialCategory: 'general', user: { id: 'u1' }, t: T, lang: 'fr',
  darkMode: false, baseRecipes: [], recipeNames: {}, attachableRecipes: [],
  onClose: vi.fn(), onSaved: vi.fn(),
}

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText('Titre du post'), { target: { value: 'Un titre valide' } })
  fireEvent.change(screen.getByPlaceholderText('Ton message…'), { target: { value: 'Un message assez long pour passer la validation.' } })
}

beforeEach(() => {
  mockCreatePost.mockReset(); mockUpdatePost.mockReset()
  mockCanPost.mockReset().mockResolvedValue(true)
  mockModerate.mockReset()
})

describe('ComposeModal — modération avant publication', () => {
  it('post valide : appelle moderateContent avant createPost', async () => {
    mockModerate.mockResolvedValue({ flagged: false })
    mockCreatePost.mockResolvedValue({ data: { id: 'p1' } })
    render(<ComposeModal {...baseProps} />)
    fillValidForm()
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(mockCreatePost).toHaveBeenCalled())
    expect(mockModerate).toHaveBeenCalledWith('Un titre valide\nUn message assez long pour passer la validation.', 'community-post')
  })

  it('flagged=true : bloque la publication, createPost jamais appelé', async () => {
    mockModerate.mockResolvedValue({ flagged: true })
    render(<ComposeModal {...baseProps} />)
    fillValidForm()
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(screen.getByText('Bloqué par la modération.')).toBeInTheDocument())
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('erreur réseau de modération : fail-closed, createPost jamais appelé', async () => {
    mockModerate.mockRejectedValue(new Error('network'))
    render(<ComposeModal {...baseProps} />)
    fillValidForm()
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(screen.getByText('Vérification impossible, réessaie.')).toBeInTheDocument())
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('édition d\'un post existant : repasse aussi par la modération, updatePost jamais appelé si flagged', async () => {
    mockModerate.mockResolvedValue({ flagged: true })
    render(<ComposeModal {...baseProps} initialPost={{ id: 'p1', category: 'general', title: 'Ancien titre', body: 'Ancien message propre', recipe_id: null }} />)
    fireEvent.change(screen.getByPlaceholderText('Ton message…'), { target: { value: 'Devenu un message abusif assez long.' } })
    fireEvent.click(screen.getByText('Mettre à jour'))
    await waitFor(() => expect(mockModerate).toHaveBeenCalled())
    expect(mockUpdatePost).not.toHaveBeenCalled()
  })
})

// Régression i18n : ces deux libellés d'accessibilité étaient écrits en anglais
// dans le JSX, donc identiques quelle que soit la langue de l'interface.
describe('ComposeModal — libellés d\'accessibilité traduits', () => {
  it('le bouton de fermeture prend son libellé dans t', () => {
    render(<ComposeModal {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
  })

  it('le bouton de retrait de la recette attachée prend son libellé dans t', () => {
    render(<ComposeModal {...baseProps}
      initialPost={{ id: 'p1', category: 'general', title: 'Un titre', body: 'Un message assez long pour être valide.', recipe_id: 'r1' }}
      recipeNames={{ r1: { fr: 'Tarte aux pommes' } }} />)
    expect(screen.getByRole('button', { name: 'Retirer la recette' })).toBeInTheDocument()
  })
})

// Audit du 2026-10-04, CPT-10 : l'écran importait leo-profanity lui-même et ne
// reconnaissait le français que si le module partagé (shared/lib/moderation.js)
// avait été chargé avant — « connard » passait.
describe('ComposeModal — grossièretés en français (CPT-10)', () => {
  it('un titre injurieux est refusé avant toute modération, rien n’est publié', async () => {
    render(<ComposeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('Titre du post'), { target: { value: 'Quel connard ce chef' } })
    fireEvent.change(screen.getByPlaceholderText('Ton message…'), { target: { value: 'Un message assez long pour passer la validation.' } })
    fireEvent.click(screen.getByText('Publier'))
    expect(await screen.findByText('profanité')).toBeInTheDocument()
    expect(mockModerate).not.toHaveBeenCalled()
    expect(mockCreatePost).not.toHaveBeenCalled()
  })
})
