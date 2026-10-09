import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReviewForm } from '@features/recipes/components/recipe-reviews-section'

const { mockUpsert, mockModerate } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockModerate: vi.fn(),
}))
vi.mock('@features/recipes/api/recipe-reviews', () => ({
  upsertReview: (...args) => mockUpsert(...args),
}))
vi.mock('@shared/hooks/use-moderation', () => ({
  moderateContent: (...args) => mockModerate(...args),
}))

const T = {
  formTitle: 'Ton avis', formRating: 'Note', formBody: 'Commentaire (optionnel)',
  formBodyPh: 'Partage ton expérience…', formSubmit: 'Publier', formSubmitEdit: 'Mettre à jour',
  cancel: 'Annuler', bodyTooLong: (n) => `trop long (${n})`, profanityWarning: 'profanité',
  contentBlocked: 'Bloqué par la modération.', moderationError: 'Vérification impossible, réessaie.',
  starsLabel: (n) => n === 1 ? '1 étoile' : `${n} étoiles`,
}

const baseProps = {
  initial: null, recipeId: 'r1', recipeSource: 'base', userId: 'u1',
  t: T, darkMode: false, border: '#ccc', muted: '#999', fg: '#000', cardBg: '#fff',
  onCancel: vi.fn(), onSaved: vi.fn(),
}

beforeEach(() => {
  mockUpsert.mockReset()
  mockModerate.mockReset()
})

describe('ReviewForm — modération avant publication', () => {
  it('note seule (sans commentaire) : aucun appel de modération', async () => {
    mockUpsert.mockResolvedValue({ data: { id: 'rev1', rating: 5 } })
    render(<ReviewForm {...baseProps} />)
    fireEvent.click(screen.getByLabelText('5/5'))
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled())
    expect(mockModerate).not.toHaveBeenCalled()
  })

  it('commentaire non vide : appelle moderateContent avant upsertReview', async () => {
    mockModerate.mockResolvedValue({ flagged: false })
    mockUpsert.mockResolvedValue({ data: { id: 'rev1', rating: 4, body: 'Très bon' } })
    render(<ReviewForm {...baseProps} />)
    fireEvent.click(screen.getByLabelText('4/5'))
    fireEvent.change(screen.getByPlaceholderText('Partage ton expérience…'), { target: { value: 'Très bon' } })
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled())
    expect(mockModerate).toHaveBeenCalledWith('Très bon', 'review')
  })

  it('flagged=true : bloque la publication, upsertReview jamais appelé', async () => {
    mockModerate.mockResolvedValue({ flagged: true })
    render(<ReviewForm {...baseProps} />)
    fireEvent.click(screen.getByLabelText('3/5'))
    fireEvent.change(screen.getByPlaceholderText('Partage ton expérience…'), { target: { value: 'contenu limite' } })
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(screen.getByText('Bloqué par la modération.')).toBeInTheDocument())
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('erreur réseau de modération : fail-closed, upsertReview jamais appelé', async () => {
    mockModerate.mockRejectedValue(new Error('network'))
    render(<ReviewForm {...baseProps} />)
    fireEvent.click(screen.getByLabelText('2/5'))
    fireEvent.change(screen.getByPlaceholderText('Partage ton expérience…'), { target: { value: 'un avis' } })
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(screen.getByText('Vérification impossible, réessaie.')).toBeInTheDocument())
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('édition d\'un avis existant en contenu abusif : repasse aussi par la modération', async () => {
    mockModerate.mockResolvedValue({ flagged: true })
    render(<ReviewForm {...baseProps} initial={{ id: 'rev1', rating: 5, body: 'propre' }} />)
    fireEvent.change(screen.getByPlaceholderText('Partage ton expérience…'), { target: { value: 'devenu abusif' } })
    fireEvent.click(screen.getByText('Mettre à jour'))
    await waitFor(() => expect(mockModerate).toHaveBeenCalledWith('devenu abusif', 'review'))
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
