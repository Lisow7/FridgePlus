import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  loadReviews: vi.fn(), getMyReview: vi.fn(), upsertReview: vi.fn(), deleteReview: vi.fn(), reportReview: vi.fn(),
}))
const signaler = vi.hoisted(() => vi.fn())

vi.mock('@features/recipes/api/recipe-reviews', () => ({
  ...api,
  aggregateReviews: (liste) => ({
    avg: liste.length ? liste.reduce((somme, avis) => somme + avis.rating, 0) / liste.length : 0,
    count: liste.length,
  }),
}))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@shared/api/community', () => ({ getCommunityTermsAcceptedAt: vi.fn().mockResolvedValue('2026-01-01T00:00:00Z') }))
vi.mock('@shared/hooks/use-moderation', () => ({ moderateContent: vi.fn(), submitPhotoPost: vi.fn() }))
vi.mock('@shared/lib/media/compress-image', () => ({ compressImageToBase64: vi.fn() }))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => async () => true }))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))

import RecipeReviewsSection from '@features/recipes/components/recipe-reviews-section'

// Hors audit, trouvé le 2026-10-05.
//  - Les avis pas chargés s'affichaient « Pas encore d'avis. Sois le premier à
//    noter ! » : la lecture rendait une liste vide sur erreur.
//  - La suppression de son avis le retirait de l'écran même quand la base
//    refusait : il revenait au rechargement.
const MON_AVIS = { id: 'a-moi', user_id: 'u1', rating: 4, body: 'Très bon', created_at: '2026-09-01T10:00:00Z', profile: { username: 'Bob' } }
const AUTRE_AVIS = { id: 'a-autre', user_id: 'u2', rating: 5, body: 'Parfait', created_at: '2026-09-02T10:00:00Z', profile: { username: 'Alice' } }
const PANNE = { message: 'Failed to fetch' }

const monter = () => render(<RecipeReviewsSection recipeId="r1" recipeSource="base" lang="fr" defaultCollapsed={false} />)

describe('RecipeReviewsSection — auteur pas chargé (audit du 2026-10-04, BDD-13)', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getMyReview.mockResolvedValue(null)
  })

  it('« Auteur non chargé », pas « Anonyme » : une lecture ratée n’est pas un compte supprimé', async () => {
    api.loadReviews.mockResolvedValue({ reviews: [{ ...AUTRE_AVIS, profile: null, profileUnavailable: true }], error: null })
    monter()
    expect(await screen.findByText('Parfait')).toBeInTheDocument()
    expect(screen.getByText('Auteur non chargé')).toBeInTheDocument()
    expect(screen.queryByText('Anonyme')).toBeNull()
  })

  it('témoin — compte supprimé : « Anonyme »', async () => {
    api.loadReviews.mockResolvedValue({ reviews: [{ ...AUTRE_AVIS, profile: null }], error: null })
    monter()
    expect(await screen.findByText('Anonyme')).toBeInTheDocument()
  })
})

describe('RecipeReviewsSection — avis pas chargés', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    signaler.mockReset()
    api.getMyReview.mockResolvedValue(null)
  })

  it('témoin — aucun avis, chargé : « Pas encore d’avis »', async () => {
    api.loadReviews.mockResolvedValue({ reviews: [], error: null })
    monter()
    expect(await screen.findByText(/Pas encore d'avis/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('lecture refusée : le dit, et propose de réessayer — pas « Pas encore d’avis », pas « Aucun avis »', async () => {
    api.loadReviews.mockResolvedValue({ reviews: [], error: PANNE })
    monter()
    expect(await screen.findByRole('alert')).toHaveTextContent('Les avis n\'ont pas pu être chargés.')
    expect(screen.queryByText(/Pas encore d'avis/)).toBeNull()
    expect(screen.queryByText('Aucun avis')).toBeNull()
  })

  it('« Réessayer » recharge ; une fois chargés, les avis s’affichent', async () => {
    api.loadReviews
      .mockResolvedValueOnce({ reviews: [], error: PANNE })
      .mockResolvedValueOnce({ reviews: [AUTRE_AVIS], error: null })
    monter()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Parfait')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.loadReviews).toHaveBeenCalledTimes(2)
  })

  it('un chargement qui lève (réseau coupé) : dit aussi', async () => {
    api.loadReviews.mockRejectedValue(new TypeError('Failed to fetch'))
    monter()
    expect(await screen.findByRole('alert')).toHaveTextContent('Les avis n\'ont pas pu être chargés.')
  })
})

describe('RecipeReviewsSection — supprimer son avis', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    signaler.mockReset()
    api.loadReviews.mockResolvedValue({ reviews: [MON_AVIS, AUTRE_AVIS], error: null })
    api.getMyReview.mockResolvedValue(MON_AVIS)
  })

  it('la base accepte : l’avis quitte la liste, rien n’est dit (témoin)', async () => {
    api.deleteReview.mockResolvedValue({ ok: true })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: /Supprimer/ }))
    await waitFor(() => expect(screen.queryByText('Très bon')).toBeNull())
    expect(screen.getByText('Parfait')).toBeInTheDocument()
    expect(signaler).not.toHaveBeenCalled()
  })

  it('la base refuse : l’avis reste à l’écran, et c’est dit', async () => {
    api.deleteReview.mockResolvedValue({ error: 'Failed to fetch' })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: /Supprimer/ }))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('removal'))
    expect(screen.getByText('Très bon')).toBeInTheDocument()
    // Le bouton est toujours là : on peut réessayer.
    expect(screen.getByRole('button', { name: /Supprimer/ })).toBeInTheDocument()
  })

  it('une suppression qui lève (réseau coupé) : l’avis reste, et c’est dit', async () => {
    api.deleteReview.mockRejectedValue(new TypeError('Failed to fetch'))
    monter()
    fireEvent.click(await screen.findByRole('button', { name: /Supprimer/ }))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('removal'))
    expect(screen.getByText('Très bon')).toBeInTheDocument()
  })
})
