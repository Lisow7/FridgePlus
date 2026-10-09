import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))
vi.mock('@features/recipes/api/recipe-reviews', () => ({
  loadReviews: vi.fn().mockResolvedValue({ reviews: [{ id: 'r1', user_id: 'u1', rating: 4, body: 'Top', profile: { username: 'Marie' }, created_at: '2026-01-01' }], error: null }),
  getMyReview: vi.fn().mockResolvedValue({ id: 'r1', user_id: 'u1', rating: 4, body: 'Top' }),
  upsertReview: vi.fn(),
  deleteReview: vi.fn().mockResolvedValue({}),
  aggregateReviews: () => ({ avg: 4, count: 1 }),
  reportReview: vi.fn(),
}))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))
vi.mock('@shared/api/community', () => ({
  getCommunityTermsAcceptedAt: vi.fn().mockResolvedValue('2026-01-01'),
}))

import RecipeReviewsSection from '@features/recipes/components/recipe-reviews-section'

describe('RecipeReviewsSection — supprimer son avis', () => {
  it('appelle useConfirm() (danger) et annule la suppression si confirm() résout false', async () => {
    const { deleteReview } = await import('@features/recipes/api/recipe-reviews')
    confirmMock.mockResolvedValue(false)
    render(<RecipeReviewsSection recipeId="rec1" recipeSource="base" lang="fr" defaultCollapsed={false} />)
    await waitFor(() => screen.getByText('Supprimer mon avis'))
    fireEvent.click(screen.getByText('Supprimer mon avis'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Supprimer ton avis ?',
      danger: true,
    })))
    // Assertion : deleteReview ne doit PAS être appelé quand confirm résout false
    expect(deleteReview).not.toHaveBeenCalled()
  })

  it('appelle deleteReview() si confirm() résout true', async () => {
    const { deleteReview } = await import('@features/recipes/api/recipe-reviews')
    confirmMock.mockResolvedValue(true)
    render(<RecipeReviewsSection recipeId="rec1" recipeSource="base" lang="fr" defaultCollapsed={false} />)
    await waitFor(() => screen.getByText('Supprimer mon avis'))
    fireEvent.click(screen.getByText('Supprimer mon avis'))
    await waitFor(() => expect(deleteReview).toHaveBeenCalledWith('r1'))
  })
})

describe('RecipeReviewsSection — nesting DOM valide', () => {
  it('aucun <button> imbriqué dans un autre <button> (header accordéon + étoiles moyenne)', async () => {
    const { container } = render(<RecipeReviewsSection recipeId="rec1" recipeSource="base" lang="fr" defaultCollapsed={false} />)
    await waitFor(() => screen.getByText('Supprimer mon avis'))
    expect(container.querySelectorAll('button button').length).toBe(0)
  })
})
