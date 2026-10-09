import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

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
  // Test that recipesById is a Map and contains a recipe from STATIC_RECIPES
  // (which the DataProvider loads initially)
  const found = recipesById.get('carbonara')
  const isMap = recipesById instanceof Map
  return (
    <div data-testid="probe">
      {isMap && found ? `carbonara-found` : 'not-found'}
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockImplementation((table) => {
    if (table === 'recipes_unified') {
      return makeBuilder({ data: [{ id: 'houmous', name: { fr: 'Houmous' }, ingredients: [], steps: {}, allergens: [] }] })
    }
    return makeBuilder({ data: [] })
  })
})

describe('useBaseRecipes recipesById', () => {
  it('expose une Map id → recette après chargement', async () => {
    render(<DataProvider><Probe /></DataProvider>)
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('carbonara-found'))
  })
})
