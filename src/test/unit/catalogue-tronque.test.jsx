import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Le catalogue est lu en entier, sans `.limit` : l'API de la base rend au plus
// `max_rows` lignes (1 000 par défaut) et TRONQUE EN SILENCE au-delà (audit du
// 2026-10-04, ARCH-11). 515 recettes et 653 ingrédients aujourd'hui ; le jour
// où l'une des tables passe 1 000 lignes, l'app continuerait avec un catalogue
// amputé sans que personne ne le sache. Désormais chaque lecture demande le
// compte exact et dit (journal d'erreurs) quand il ne reçoit pas tout.

const mockFrom = vi.hoisted(() => vi.fn())
const mockLogError = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: mockLogError, setSentryUser: vi.fn(), clearSentryUser: vi.fn() }))

import { DataProvider, useBaseRecipes } from '@shared/contexts/data-provider'

function builder(reponse) {
  const b = {
    select: vi.fn(() => b), eq: () => b, in: () => b, order: () => b,
    then: (resolve, reject) => Promise.resolve(reponse).then(resolve, reject),
  }
  return b
}
const RECETTE = { id: 'affogato', name: { fr: 'Affogato' }, ingredients: [], steps: {}, allergens: [] }
let reponses
let builders
function installer() {
  builders = {}
  mockFrom.mockImplementation((table) => {
    const b = builder(reponses[table] ?? { data: [], error: null })
    builders[table] = b
    return b
  })
}
function Sonde() {
  const { catalogStatus, recipes } = useBaseRecipes()
  return <div><span data-testid="etat">{catalogStatus}</span><span data-testid="nombre">{recipes.length}</span></div>
}
async function laisserCharger() {
  await act(async () => { vi.advanceTimersByTime(3100) })
  await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve() })
}

describe('DataProvider — une lecture tronquée se dit', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); reponses = {}; installer() })
  afterEach(() => { vi.useRealTimers() })

  it('chaque lecture demande le compte exact', async () => {
    reponses.recipes_unified = { data: [RECETTE], error: null, count: 1 }
    render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()
    for (const table of ['ingredients', 'recipes_unified', 'taxonomies', 'fridge_layouts']) {
      expect(builders[table]?.select, table).toHaveBeenCalledWith(expect.any(String), { count: 'exact' })
    }
  })

  it('moins de lignes reçues que comptées : le catalogue sert, et le journal le dit', async () => {
    reponses.recipes_unified = { data: [RECETTE], error: null, count: 2 }
    render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()
    expect(screen.getByTestId('etat')).toHaveTextContent('ok')
    expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ tag: 'catalogue.tronque', nom: 'recettes', recues: 1, total: 2 }))
  })

  it('tout reçu, ou pas de compte : rien à dire', async () => {
    reponses.recipes_unified = { data: [RECETTE], error: null, count: 1 }
    reponses.ingredients = { data: [], error: null, count: null }
    render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()
    expect(mockLogError).not.toHaveBeenCalled()
  })
})
