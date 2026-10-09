// Dans un bac qui a des groupes, les ingrédients SANS groupe doivent suivre le
// même flow que les autres : une section « Autres » pliable, pas une grille
// orpheline sans en-tête (demande user 2026-08-27).
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/contexts/data-provider', () => ({ useIngredientsById: () => ({}) }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1400 }))

import SubcategoryModal from '@shared/ui/subcategory-modal'

const base = {
  compartment: { id: 'crisper', label: 'Légumes & Fruits' },
  subcategory: { id: 'vegetables', label: 'Légumes' },
  stock: new Set(),
  onToggle: vi.fn(), onClose: vi.fn(), lang: 'fr',
}

const AVEC_GROUPES = [
  { id: 'vg-alliums', labels: { fr: 'Alliums' }, emoji: '🧄' },
  { id: 'vg-ail', labels: { fr: 'Ail' }, emoji: '🧄', group_id: 'vg-alliums' },
  { id: 'vg-echalote', labels: { fr: 'Échalote' }, emoji: '🧅', group_id: 'vg-alliums' },
  { id: 'vg-artichaut', labels: { fr: 'Artichaut' }, emoji: '🌿' },
  { id: 'vg-celeri', labels: { fr: 'Céleri' }, emoji: '🥬' },
]

describe('SubcategoryModal — section « Autres » pour les sans-groupe', () => {
  it('les items sans groupe vivent sous un en-tête « Autres » pliable', () => {
    render(<SubcategoryModal {...base} ingredients={AVEC_GROUPES} />)
    const header = screen.getByRole('button', { name: /Autres/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Artichaut')).toBeInTheDocument()
    // Replier « Autres » masque ses items mais pas ceux des groupes
    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Artichaut')).toBeNull()
    expect(screen.getByText('Ail')).toBeInTheDocument()
  })

  it('l’en-tête « Autres » porte le compteur sélectionnés/total comme les groupes', () => {
    render(<SubcategoryModal {...base} ingredients={AVEC_GROUPES} stock={new Set(['vg-celeri'])} />)
    const header = screen.getByRole('button', { name: /Autres/ })
    expect(header.textContent).toContain('1/2')
  })

  it('sans aucun groupe dans le bac : pas d’en-tête « Autres » (le titre du bac suffit)', () => {
    render(<SubcategoryModal {...base} ingredients={[
      { id: 'vg-artichaut', labels: { fr: 'Artichaut' }, emoji: '🌿' },
      { id: 'vg-celeri', labels: { fr: 'Céleri' }, emoji: '🥬' },
    ]} />)
    expect(screen.queryByRole('button', { name: /Autres/ })).toBeNull()
    expect(screen.getByText('Artichaut')).toBeInTheDocument()
  })

  it('en anglais, l’en-tête dit « Others »', () => {
    render(<SubcategoryModal {...base} lang="en" ingredients={AVEC_GROUPES} />)
    expect(screen.getByRole('button', { name: /Others/ })).toBeInTheDocument()
  })
})
