// Tests unit — RecipeNutritionTab, extrait de recipe-modal.jsx (audit front §2).
// Onglet purement présentationnel : reçoit les valeurs déjà calculées (par
// portion) + les libellés i18n.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/ui/info-tooltip', () => ({ default: () => null }))

import RecipeNutritionTab from '@features/recipes/components/recipe-modal-nutrition-tab'

const t = {
  nutritionLabel: 'Nutrition (par portion)',
  nutritionInfo: 'Valeurs estimées',
  calLabel: 'Calories', protLabel: 'Protéines', carbLabel: 'Glucides',
  fatLabel: 'Lipides', fibLabel: 'Fibres',
  noNutrition: 'Données indisponibles',
}

describe('RecipeNutritionTab', () => {
  it('affiche les 5 valeurs nutritionnelles quand il y a des données', () => {
    const nutrition = { hasData: true, cal: 250, prot: 12, carb: 30, fat: 8, fib: 4 }
    render(<RecipeNutritionTab nutrition={nutrition} t={t} isMobile lang="fr" />)
    expect(screen.getByText('250 kcal')).toBeInTheDocument()
    expect(screen.getByText('12 g')).toBeInTheDocument()
    expect(screen.getByText('30 g')).toBeInTheDocument()
    expect(screen.getByText('8 g')).toBeInTheDocument()
    expect(screen.getByText('4 g')).toBeInTheDocument()
    expect(screen.getByText('Nutrition (par portion)')).toBeInTheDocument()
  })

  it('affiche le message d\'indisponibilité quand il n\'y a pas de données', () => {
    render(<RecipeNutritionTab nutrition={{ hasData: false }} t={t} />)
    expect(screen.getByText('Données indisponibles')).toBeInTheDocument()
  })

  it('trie les nutriments par ordre alphabétique du libellé sur desktop', () => {
    const nutrition = { hasData: true, cal: 250, prot: 12, carb: 30, fat: 8, fib: 4 }
    render(<RecipeNutritionTab nutrition={nutrition} t={t} isMobile={false} lang="fr" />)
    const labels = screen.getAllByText(/^(Calories|Protéines|Glucides|Lipides|Fibres)$/).map(n => n.textContent)
    expect(labels).toEqual(['Calories', 'Fibres', 'Glucides', 'Lipides', 'Protéines'])
  })
})
