import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Le parcours de l'audit, de bout en bout dans le code (PERF-02) : un visiteur
// arrive de Google sur `/recipe/affogato` — une recette absente des 100
// embarquées — et le catalogue n'arrive pas (lent, ou en panne). Le vrai
// fournisseur de données et le vrai résolveur, seul le client Supabase est
// simulé.

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))

// Importés à neuf pour chaque test (voir beforeEach) : une fiche lue est
// gardée pour la session, et chaque test doit partir d'une session vierge.
let DataProvider, useBaseRecipes, useRecipeById

const AFFOGATO = {
  id: 'affogato',
  name: { fr: 'Affogato', en: 'Affogato' },
  emoji: '🍨',
  time_min: 5,
  difficulty: 'very-easy',
  type: 'dessert',
  servings: 2,
  ingredients: [],
  steps: { fr: ['Verser le café sur la glace.'] },
  status: 'published',
}

let lecturesDUneFiche
let catalogue // 'tenu' : ne répond jamais ; 'panne' : refusé à chaque essai ; 'mince' : arrive, sans les étapes

function builder(table) {
  const filtres = {}
  const b = {
    select: () => b,
    in: () => b,
    order: () => b,
    is: () => b,
    eq: (col, val) => { filtres[col] = val; return b },
    maybeSingle: () => {
      if (table === 'recipes_unified') {
        lecturesDUneFiche++
        return Promise.resolve({ data: filtres.id === 'affogato' ? AFFOGATO : null, error: null })
      }
      // custom_recipes : rien à ce nom.
      return Promise.resolve({ data: null, error: null })
    },
    then: (resolve, reject) => {
      if (table === 'recipes_unified' && catalogue === 'tenu') return new Promise(() => {})
      if (table === 'recipes_unified' && catalogue === 'mince') {
        const { steps: _etapes, ...mince } = AFFOGATO
        return Promise.resolve({ data: [mince], error: null }).then(resolve, reject)
      }
      if (table === 'recipes_unified' && catalogue === 'panne') {
        return Promise.resolve({ data: null, error: { message: 'boom' } }).then(resolve, reject)
      }
      return Promise.resolve({ data: [], error: null }).then(resolve, reject)
    },
  }
  return b
}

function Fiche({ id }) {
  const { recipe, status } = useRecipeById(id)
  const { recipeNames } = useBaseRecipes()
  return (
    <div>
      <span data-testid="statut">{status}</span>
      <span data-testid="nom">{recipeNames?.[id]?.fr ?? ''}</span>
      <span data-testid="etapes">{recipe?.steps?.fr?.join(' ') ?? ''}</span>
    </div>
  )
}

describe('fiche ouverte par un lien direct, catalogue absent', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    lecturesDUneFiche = 0
    mockFrom.mockImplementation((table) => builder(table))
    vi.resetModules()
    ;({ DataProvider, useBaseRecipes } = await import('@shared/contexts/data-provider'))
    ;({ useRecipeById } = await import('@features/recipes/hooks/use-recipe-by-id'))
  })

  for (const etat of ['tenu', 'panne']) {
    it(`catalogue ${etat} : la fiche s’ouvre, avec son nom et ses étapes, sans jamais dire « introuvable »`, async () => {
      catalogue = etat
      const statuts = []
      function Espion() {
        const { status } = useRecipeById('affogato')
        statuts.push(status)
        return null
      }
      render(<DataProvider><Fiche id="affogato" /><Espion /></DataProvider>)

      await waitFor(() => expect(screen.getByTestId('statut')).toHaveTextContent('ok'))
      expect(screen.getByTestId('etapes')).toHaveTextContent('Verser le café sur la glace.')
      await waitFor(() => expect(screen.getByTestId('nom')).toHaveTextContent('Affogato'))
      expect(statuts).not.toContain('not-found')
    })
  }

  // Le catalogue arrivé n'a plus les étapes (PERF-01) : la fiche les lit, une fois.
  it('catalogue arrivé, mince : la fiche lit ses étapes, une seule fois', async () => {
    catalogue = 'mince'
    render(<DataProvider><Fiche id="affogato" /></DataProvider>)

    await waitFor(() => expect(screen.getByTestId('etapes')).toHaveTextContent('Verser le café sur la glace.'), { timeout: 3000 })
    await new Promise((r) => setTimeout(r, 50))
    expect(lecturesDUneFiche).toBe(1)
  })

  // Confier le nom au catalogue ne doit pas relancer la lecture en boucle.
  it('une seule lecture de la fiche, même après que le nom est confié au catalogue', async () => {
    catalogue = 'tenu'
    render(<DataProvider><Fiche id="affogato" /></DataProvider>)

    await waitFor(() => expect(screen.getByTestId('nom')).toHaveTextContent('Affogato'))
    await new Promise((r) => setTimeout(r, 50))
    expect(lecturesDUneFiche).toBe(1)
  })
})
