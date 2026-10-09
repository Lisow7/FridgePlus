import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WhatsNextRecipesCard from '@features/cart/components/whats-next-recipes-card'

vi.mock('@shared/ui/emoji', () => ({ default: ({ char }) => <span>{char}</span> }))

const recipes = [
  { id: 'r1', emoji: '🍝', matchPercent: 1, name: { fr: 'Pâtes' } },
  { id: 'r2', emoji: '🥗', matchPercent: 0.8, name: { fr: 'Salade' } },
]

describe('WhatsNextRecipesCard', () => {
  it('rend les recettes avec %', () => {
    render(<WhatsNextRecipesCard recipes={recipes} lang="fr" favorites={new Set()} />)
    expect(screen.getByText('Pâtes')).toBeInTheDocument()
    expect(screen.getByText(/100\s*%/)).toBeInTheDocument()
  })
  it('cœur favori appelle onToggleFavorite avec l\'id', () => {
    const onToggleFavorite = vi.fn()
    render(<WhatsNextRecipesCard recipes={recipes} lang="fr" favorites={new Set()} onToggleFavorite={onToggleFavorite} />)
    fireEvent.click(screen.getAllByLabelText(/favori/i)[0])
    expect(onToggleFavorite).toHaveBeenCalledWith('r1')
  })
  it('clic sur la recette appelle onShowRecipe', () => {
    const onShowRecipe = vi.fn()
    render(<WhatsNextRecipesCard recipes={recipes} lang="fr" favorites={new Set()} onShowRecipe={onShowRecipe} />)
    fireEvent.click(screen.getByText('Pâtes'))
    expect(onShowRecipe).toHaveBeenCalledWith(recipes[0])
  })
  it('empty-state si aucune recette', () => {
    render(<WhatsNextRecipesCard recipes={[]} lang="fr" favorites={new Set()} />)
    expect(screen.getByText(/aucune recette/i)).toBeInTheDocument()
  })
})
