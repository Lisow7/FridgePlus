import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Une page « introuvable » n'est pas référencée (audit du 2026-10-04, SEO-03).
//
// Toute adresse inconnue répondait 200 avec la coquille de l'accueil, et
// l'écran « introuvable » n'était qu'un message : pour un robot, une adresse
// morte était indiscernable d'une vraie page (« soft 404 »). Méthode
// recommandée par Google pour les applications à page unique : poser
// `<meta name="robots" content="noindex">` par le JavaScript, et un titre qui
// dit « introuvable ».

const etatFiche = vi.hoisted(() => ({ valeur: { recipe: null, status: 'not-found' } }))
vi.mock('@features/recipes/hooks/use-recipe-by-id', () => ({ useRecipeById: () => etatFiche.valeur }))
vi.mock('@shared/contexts/session-state-context', () => ({
  useStockSession: () => ({ stock: new Set(), toggleIngredient: () => {} }),
  useFavoritesSession: () => ({ favorites: new Set(), toggleFavorite: () => {} }),
  useCartSession: () => ({ basket: [], basketRecipeIds: new Set(), refresh: () => {} }),
}))
vi.mock('@shared/contexts/recipe-form-context', () => ({ useRecipeForm: () => ({ openEdit: () => {} }) }))
vi.mock('@shared/contexts/deleting-recipe-context', () => ({ useDeletingRecipe: () => ({ requestDelete: () => {} }) }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null, allergenPrefs: [] }) }))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: false }) }))
vi.mock('@shared/contexts/data-provider', () => ({ useIngredientsById: () => new Map(), useBaseRecipes: () => ({ recipeNames: {} }) }))
vi.mock('@features/cart/hooks/use-cart-actions', () => ({ useCartActions: () => ({ handleAddToCart: () => {} }) }))
vi.mock('@features/recipes/components/recipe-modal', () => ({ default: () => <div>fiche</div> }))

import NotFoundPage from '@app/pages/not-found-page'
import RecipePage from '@features/recipes/pages/recipe-page'

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null

describe('une page introuvable n’est pas référencée', () => {
  it('page inconnue : noindex et titre « Page introuvable », retirés en quittant', () => {
    render(<MemoryRouter><NotFoundPage lang="fr" /></MemoryRouter>)
    expect(robots()).toBe('noindex')
    expect(document.title).toMatch(/Page introuvable/)

    cleanup()
    expect(robots()).toBeNull()
  })

  // Le chemin de la production : `index.html` porte déjà
  // `<meta name="robots" content="index, follow">`. Une SECONDE balise
  // laisserait deux consignes contradictoires ; c'est la balise existante qui
  // doit dire `noindex`, puis retrouver sa valeur en quittant la page.
  it('balise robots déjà servie : réécrite en noindex, puis rendue', () => {
    const servie = document.createElement('meta')
    servie.setAttribute('name', 'robots')
    servie.setAttribute('content', 'index, follow')
    document.head.appendChild(servie)

    render(<MemoryRouter><NotFoundPage lang="fr" /></MemoryRouter>)
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
    expect(robots()).toBe('noindex')

    cleanup()
    expect(robots()).toBe('index, follow')
    servie.remove()
  })

  it('fiche introuvable : noindex', () => {
    etatFiche.valeur = { recipe: null, status: 'not-found' }
    render(<MemoryRouter><RecipePage lang="fr" /></MemoryRouter>)
    expect(screen.getByText('Recette introuvable')).toBeInTheDocument()
    expect(robots()).toBe('noindex')
    cleanup()
  })

  // Une panne n'est pas une absence : on ne déréférence pas une vraie fiche
  // parce que le réseau a flanché.
  it('fiche momentanément indisponible : PAS de noindex', () => {
    etatFiche.valeur = { recipe: null, status: 'error' }
    render(<MemoryRouter><RecipePage lang="fr" /></MemoryRouter>)
    expect(robots()).toBeNull()
    cleanup()
  })

  // Audit du 2026-10-04, P-09 : sur une recette inconnue, l'onglet gardait le
  // titre de l'accueil — en français même pour un visiteur anglophone.
  it('fiche introuvable : l’onglet le dit, dans la langue affichée, puis rend son titre', () => {
    etatFiche.valeur = { recipe: null, status: 'not-found' }
    document.title = 'Fridge+ — accueil'
    render(<MemoryRouter><RecipePage lang="en" /></MemoryRouter>)
    expect(document.title).toBe('Recipe not found — Fridge+')
    cleanup()
    expect(document.title).toBe('Fridge+ — accueil')
  })

  it('fiche momentanément indisponible : l’onglet dit la panne, pas l’absence', () => {
    etatFiche.valeur = { recipe: null, status: 'error' }
    render(<MemoryRouter><RecipePage lang="fr" /></MemoryRouter>)
    expect(document.title).toBe('Recette momentanément indisponible — Fridge+')
    cleanup()
  })

  it('fiche trouvée dont le nom n’est pas encore arrivé : l’onglet ne dit pas « introuvable »', () => {
    etatFiche.valeur = { recipe: { id: 'carbonara' }, status: 'ok' }
    document.title = 'Fridge+ — accueil'
    render(<MemoryRouter><RecipePage lang="fr" /></MemoryRouter>)
    expect(document.title).toBe('Fridge+ — accueil')
    cleanup()
  })

  it('fiche trouvée : pas de noindex', () => {
    etatFiche.valeur = { recipe: { id: 'carbonara' }, status: 'ok' }
    render(<MemoryRouter><RecipePage lang="fr" /></MemoryRouter>)
    expect(robots()).toBeNull()
    cleanup()
  })
})
