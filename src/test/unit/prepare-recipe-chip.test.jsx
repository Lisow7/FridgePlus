import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrepareRecipeChip from '@features/cart/components/prepare-recipe-chip'

const baseRecipe = {
  recipe_id: 'spaghetti-bolo',
  recipe_name: 'Spaghetti bolognaise',
  recipe_emoji: '🍝',
  servings: 2,
}

describe('PrepareRecipeChip', () => {
  it('renders emoji + name + servings', () => {
    render(<PrepareRecipeChip recipe={baseRecipe} lang="fr" />)
    expect(screen.getByText('🍝')).toBeInTheDocument()
    expect(screen.getByText('Spaghetti bolognaise')).toBeInTheDocument()
    expect(screen.getByText(/2\s*pers/i)).toBeInTheDocument()
  })

  it('calls onUpdateServings(recipeId, n+1) when + clicked', () => {
    const onUpdateServings = vi.fn()
    render(<PrepareRecipeChip recipe={baseRecipe} lang="fr" onUpdateServings={onUpdateServings} />)
    fireEvent.click(screen.getByLabelText(/augmenter les portions/i))
    expect(onUpdateServings).toHaveBeenCalledWith('spaghetti-bolo', 3)
  })

  it('does not decrement below 1', () => {
    const onUpdateServings = vi.fn()
    render(<PrepareRecipeChip recipe={{ ...baseRecipe, servings: 1 }} lang="fr" onUpdateServings={onUpdateServings} />)
    fireEvent.click(screen.getByLabelText(/diminuer les portions/i))
    expect(onUpdateServings).not.toHaveBeenCalled()
  })

  it('calls onRemoveRecipe with recipeId when 🗑 clicked', () => {
    const onRemoveRecipe = vi.fn()
    render(<PrepareRecipeChip recipe={baseRecipe} lang="fr" onRemoveRecipe={onRemoveRecipe} />)
    fireEvent.click(screen.getByLabelText(/^retirer spaghetti bolognaise$/i))
    expect(onRemoveRecipe).toHaveBeenCalledWith('spaghetti-bolo')
  })

  it('pas de bouton déployer s\'il n\'y a pas d\'ingrédients', () => {
    render(<PrepareRecipeChip recipe={baseRecipe} lang="fr" items={[]} />)
    expect(screen.queryByLabelText(/voir les ingrédients/i)).not.toBeInTheDocument()
  })

  it('déploie et affiche les ingrédients (quantités scalées) au clic', () => {
    const items = [
      { id: 'i1', label: 'Tomates', amount: 300, unit: 'g' },
      { id: 'i2', label: 'Bœuf haché', amount: 600, unit: 'g' },
    ]
    render(<PrepareRecipeChip recipe={baseRecipe} lang="fr" items={items} />)
    // Masqué par défaut
    expect(screen.queryByText('Tomates')).not.toBeInTheDocument()
    // Déploie
    fireEvent.click(screen.getByLabelText(/voir les ingrédients/i))
    expect(screen.getByText('Tomates')).toBeInTheDocument()
    expect(screen.getByText('300 g')).toBeInTheDocument()
    expect(screen.getByText('Bœuf haché')).toBeInTheDocument()
    expect(screen.getByText('600 g')).toBeInTheDocument()
  })
})
