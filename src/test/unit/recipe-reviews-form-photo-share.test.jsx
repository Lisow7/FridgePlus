import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReviewForm } from '@features/recipes/components/recipe-reviews-section'

const { mockUpsert, mockModerate, mockSubmitPhoto, mockCompress } = vi.hoisted(() => ({
  mockUpsert: vi.fn(), mockModerate: vi.fn(), mockSubmitPhoto: vi.fn(), mockCompress: vi.fn(),
}))
vi.mock('@features/recipes/api/recipe-reviews', () => ({ upsertReview: (...a) => mockUpsert(...a) }))
vi.mock('@shared/hooks/use-moderation', () => ({
  moderateContent: (...a) => mockModerate(...a),
  submitPhotoPost: (...a) => mockSubmitPhoto(...a),
}))
vi.mock('@shared/lib/media/compress-image', () => ({ compressImageToBase64: (...a) => mockCompress(...a) }))

const T = {
  formTitle: 'Ton avis', formRating: 'Note', formBody: 'Commentaire (optionnel)',
  formBodyPh: 'Partage ton expérience…', formSubmit: 'Publier', formSubmitEdit: 'Mettre à jour',
  starsLabel: (n) => `${n} étoiles`,
  cancel: 'Annuler', bodyTooLong: (n) => `trop long (${n})`, profanityWarning: 'profanité',
  contentBlocked: 'Bloqué par la modération.', moderationError: 'Vérification impossible, réessaie.',
  sharePhotoLabel: 'Partager aussi dans la communauté (avec photo)',
  sharePhotoNotice: 'Ta photo sera publique.', photoRequired: 'Ajoute une photo pour partager en communauté.',
  choosePhoto: 'Choisir une photo', shareTitle: "J'ai testé cette recette !",
}

const baseProps = {
  initial: null, recipeId: 'r1', recipeSource: 'base', userId: 'u1',
  t: T, darkMode: false, border: '#ccc', muted: '#999', fg: '#000', cardBg: '#fff',
  onCancel: vi.fn(), onSaved: vi.fn(),
}

const fakeFile = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  mockUpsert.mockReset(); mockModerate.mockReset()
  mockSubmitPhoto.mockReset(); mockCompress.mockReset()
})

describe('ReviewForm — partage communauté avec photo', () => {
  it('case cochée sans photo : bloque, rien envoyé', async () => {
    render(<ReviewForm {...baseProps} />)
    fireEvent.click(screen.getByLabelText('4/5'))
    fireEvent.click(screen.getByLabelText('Partager aussi dans la communauté (avec photo)'))
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(screen.getByText('Ajoute une photo pour partager en communauté.')).toBeInTheDocument())
    expect(mockSubmitPhoto).not.toHaveBeenCalled()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('case cochée avec photo : compresse puis appelle submitPhotoPost avec le bon payload, puis upsertReview', async () => {
    mockCompress.mockResolvedValue('base64datajpeg')
    mockSubmitPhoto.mockResolvedValue({ flagged: false, post: { id: 'p1' } })
    mockUpsert.mockResolvedValue({ data: { id: 'rev1' } })
    render(<ReviewForm {...baseProps} />)
    fireEvent.click(screen.getByLabelText('5/5'))
    fireEvent.change(screen.getByPlaceholderText('Partage ton expérience…'), { target: { value: 'Délicieux' } })
    fireEvent.click(screen.getByLabelText('Partager aussi dans la communauté (avec photo)'))
    fireEvent.change(screen.getByLabelText('Choisir une photo'), { target: { files: [fakeFile] } })
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled())
    expect(mockCompress).toHaveBeenCalledWith(fakeFile)
    expect(mockSubmitPhoto).toHaveBeenCalledWith({ content: 'Délicieux', imageBase64: 'base64datajpeg', recipeId: 'r1', title: "J'ai testé cette recette !" })
  })

  it('photo rejetée par la modération : bloque tout, upsertReview jamais appelé', async () => {
    mockCompress.mockResolvedValue('base64datajpeg')
    mockSubmitPhoto.mockResolvedValue({ flagged: true })
    render(<ReviewForm {...baseProps} />)
    fireEvent.click(screen.getByLabelText('3/5'))
    fireEvent.click(screen.getByLabelText('Partager aussi dans la communauté (avec photo)'))
    fireEvent.change(screen.getByLabelText('Choisir une photo'), { target: { files: [fakeFile] } })
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(screen.getByText('Bloqué par la modération.')).toBeInTheDocument())
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
