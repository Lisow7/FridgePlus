import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { TYPE_LABELS, TYPE_OPTIONS, TYPE_COLORS } from '@shared/static/recipe-constants'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))

import { DataProvider, useBaseRecipes } from '@shared/contexts/data-provider'

function makeBuilder(resolvedValue) {
  const builder = {
    select: vi.fn(() => builder),
    eq:     vi.fn(() => builder),
    in:     vi.fn(() => builder),
    order:  vi.fn(() => builder),
    then:   (resolve) => resolve(resolvedValue),
  }
  return builder
}

function Probe() {
  const { recipesById } = useBaseRecipes()
  const found = recipesById.get('bechamel-test')
  return <div data-testid="probe">{found ? found.type : 'not-found'}</div>
}

describe('Type "Sauce & Base" — constantes', () => {
  it('TYPE_LABELS a une entrée fr + en pour "Sauce & Base"', () => {
    expect(TYPE_LABELS.fr['Sauce & Base']).toBe('Sauce & Base')
    expect(TYPE_LABELS.en['Sauce & Base']).toBe('Sauce & Base')
  })

  it('TYPE_OPTIONS liste "Sauce & Base" en fr + en', () => {
    expect(TYPE_OPTIONS.fr.some(o => o.value === 'Sauce & Base')).toBe(true)
    expect(TYPE_OPTIONS.en.some(o => o.value === 'Sauce & Base')).toBe(true)
  })

  it('TYPE_COLORS a une entrée distincte pour "Sauce & Base"', () => {
    expect(TYPE_COLORS['Sauce & Base']).toBeDefined()
    expect(TYPE_COLORS['Sauce & Base'].bg).not.toBe(TYPE_COLORS['Plat principal'].bg)
  })
})

describe('Type "Sauce & Base" — mapping DB → affichage (data-provider)', () => {
  it('une recette avec type DB "sauce-base" devient "Sauce & Base" après chargement', async () => {
    mockFrom.mockImplementation((table) => {
      if (table === 'recipes_unified') {
        return makeBuilder({ data: [{ id: 'bechamel-test', type: 'sauce-base', name: { fr: 'Béchamel test' }, ingredients: [], steps: {}, allergens: [] }] })
      }
      return makeBuilder({ data: [] })
    })
    render(<DataProvider><Probe /></DataProvider>)
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('Sauce & Base'), { timeout: 5000 })
  })
})
