import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/contexts/data-provider', () => ({ useIngredientsById: () => ({}) }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1400 }))

import SubcategoryModal from '@shared/ui/subcategory-modal'

const props = {
  compartment: { id: 'fresh' },
  subcategory: { id: 'fr-dairy', label: 'Frais' },
  ingredients: [{ id: 'fr-lait', labels: { fr: 'Lait' } }],
  stock: new Set(['fr-lait']),
  onToggle: vi.fn(), onClose: vi.fn(), lang: 'fr',
}

describe('SubcategoryModal — sans fraîcheur/DLC (chantier 2a)', () => {
  it('ne rend aucune pastille de fraîcheur ni éditeur de date', () => {
    const { container } = render(<SubcategoryModal {...props} />)
    expect(screen.queryByTitle(/Fra[îi]cheur/i)).toBeNull()
    expect(container.querySelector('input[type="date"]')).toBeNull()
  })
  it('affiche l\'ingrédient (toggle intact)', () => {
    render(<SubcategoryModal {...props} />)
    expect(screen.getByText('Lait')).toBeInTheDocument()
  })
})
