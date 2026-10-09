import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import IngredientsEditor from '@features/admin/components/ingredients-editor'

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({ legumes: [{ id: 'vg-oignon', labels: { fr: 'Oignon', en: 'Onion' }, emoji: '🧅' }] }),
}))

// Décision du 2026-10-06 (« libellés = visibles ») : dans l'éditeur
// d'ingrédients de l'admin, chaque champ d'une ligne garde son nom à l'écran
// une fois rempli — « 200 » et « g » ne disent pas, seuls, ce qu'ils sont.
const SLOT = { ids: ['vg-oignon'], qty: { amount: 200, unit: 'g' }, labels: { fr: '200 g d’oignon' }, required: true }

describe('éditeur d’ingrédients (admin) — libellés visibles', () => {
  it('chaque champ d’une ligne est nommé par un libellé écrit à l’écran', () => {
    render(<IngredientsEditor ingredients={[SLOT]} lang="fr" onChange={() => {}} />)
    expect(screen.getByLabelText('Ingrédient')).toHaveValue('Oignon')
    expect(screen.getByLabelText('Qté')).toHaveValue(200)
    expect(screen.getByLabelText('Unité')).toHaveValue('g')
    expect(screen.getByLabelText('Libellé affiché')).toHaveValue('200 g d’oignon')
    for (const nom of ['Ingrédient', 'Qté', 'Unité', 'Libellé affiché']) {
      expect(screen.getByText(nom).closest('label'), nom).not.toBeNull()
    }
  })

  it('la zone « coller » a son libellé, et son texte grisé est un exemple', () => {
    render(<IngredientsEditor ingredients={[]} lang="fr" onChange={() => {}} />)
    const zone = screen.getByLabelText('Coller des ingrédients')
    expect(zone.tagName).toBe('TEXTAREA')
    expect(zone.getAttribute('placeholder')).toMatch(/^ex\. : /)
  })
})
