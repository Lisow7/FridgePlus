import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Le stepper « personnes » de l'ACCUEIL fait-il dériver le prix ?
//
// ── Comment ce fichier est né ────────────────────────────────────────────
// L'audit du 2026-08-28 a fini par nommer la classe de défaut dominante de ce
// dépôt : **une garantie présente à un endroit, perdue dans sa copie**. Cinq
// occurrences en une nuit. Plutôt que de continuer à les trouver une par une,
// j'ai balayé le dépôt à la recherche de fonctions JUMELLES — même nom, deux
// fichiers, corps proches mais divergents. `handleUpdateRecipeServings` est
// ressorti à 77 % de similarité, avec un écart de garde.
//
// 🔴 Et l'écart va dans le sens INVERSE de celui déjà corrigé :
// `features/cart/hooks/use-cart-actions.js` porte le correctif anti-dérive et
// le documente ; `app/hooks/use-basket-actions.js` — le chemin de l'ACCUEIL,
// câblé en `App.jsx:582` — porte encore la formule bogué :
//
//     newPrice = item.price * (safeServings / baseServings)
//
// `item.price` est le prix COURANT, tandis que le ratio est calculé depuis les
// portions INITIALES. Le prix se compose donc à chaque changement, pendant que
// la quantité, elle, repart de `amount_initial` et ne dérive pas. Les deux se
// désynchronisent : le budget estimé du panier devient faux.

const mockBatch = vi.hoisted(() => vi.fn())
vi.mock('@features/cart/api/basket', () => ({
  addBasketItems: vi.fn().mockResolvedValue({ error: null }),
  clearBasket: vi.fn().mockResolvedValue({ error: null }),
  updateBasketItemsBatch: (...a) => mockBatch(...a),
}))
vi.mock('@shared/lib/recipes/recipe-utils', () => ({ toGrams: (n) => (n ?? 0) * 1 }))
vi.mock('@shared/lib/pricing/open-prices', () => ({ getEmbeddedPrice: () => 2 }))

import { useBasketActions } from '@app/hooks/use-basket-actions'

const rafraichir = vi.fn()

function monter(panier) {
  return renderHook(() => useBasketActions({
    user: { id: 'u-1' }, lang: 'fr', basket: panier, stock: new Set(),
    ingredientsById: new Map(), refreshBasket: rafraichir,
  })).result
}

beforeEach(() => {
  mockBatch.mockReset()
  mockBatch.mockResolvedValue({ error: null })
  rafraichir.mockReset()
})

describe('Stepper « personnes » de l\'accueil — le prix ne doit pas dériver', () => {
  // Article de départ : 4 personnes, 200 g, 4 €.
  const article = {
    id: 'i-1', recipe_id: 'r-1', amount: 200, amount_initial: 200,
    recipe_servings: 4, recipe_servings_initial: 4, price: 4,
  }

  it('🔴 un aller-retour 4 → 2 → 4 rend EXACTEMENT les valeurs de départ', async () => {
    let courant = article

    // 4 → 2
    let r = monter([courant])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 2) })
    let maj = mockBatch.mock.calls[0][0][0]
    expect(maj.amount).toBe(100)
    expect(maj.price).toBe(2)

    // On rejoue l'état tel que la base le renverrait après cette écriture.
    courant = { ...courant, amount: maj.amount, price: maj.price, recipe_servings: 2 }
    mockBatch.mockClear()

    // 2 → 4 : retour au point de départ, au gramme et au centime près.
    r = monter([courant])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 4) })
    maj = mockBatch.mock.calls[0][0][0]
    expect(maj.amount, 'la quantité a dérivé').toBe(200)
    expect(
      maj.price,
      'le prix a dérivé : il est mis à l\'échelle depuis le prix COURANT alors que '
      + 'la quantité repart de la valeur INITIALE. Les deux se désynchronisent et '
      + 'le budget estimé devient faux.',
    ).toBe(4)
  })

  it('trois allers-retours ne dégradent pas davantage', async () => {
    // Une composition se voit d'autant mieux qu'on répète : ce test échouerait
    // encore plus fort que le précédent sur la formule d'origine.
    let courant = article
    for (const cible of [2, 4, 2, 4]) {
      mockBatch.mockClear()
      const r = monter([courant])
      await act(async () => { await r.current.handleUpdateRecipeServings('r-1', cible) })
      const maj = mockBatch.mock.calls[0][0][0]
      courant = { ...courant, amount: maj.amount, price: maj.price, recipe_servings: cible }
    }
    expect(courant.amount).toBe(200)
    expect(courant.price).toBe(4)
  })

  it('le prix suit proportionnellement la quantité à chaque étape', async () => {
    // Invariant plus fort que l'aller-retour : à tout moment, prix / quantité
    // doit rester constant. C'est ce que la désynchronisation casse.
    const r = monter([article])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 6) })
    const maj = mockBatch.mock.calls[0][0][0]
    expect(maj.amount).toBe(300)
    expect(maj.price / maj.amount).toBeCloseTo(article.price / article.amount, 10)
  })

  it('un prix absent le reste', async () => {
    const r = monter([{ ...article, price: null }])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 2) })
    expect(mockBatch.mock.calls[0][0][0].price).toBeNull()
  })

  it('borne le nombre de personnes entre 1 et 12', async () => {
    for (const [demande, attendu] of [[0, 1], [-3, 1], [13, 12], [2.4, 2]]) {
      mockBatch.mockClear()
      const r = monter([article])
      await act(async () => { await r.current.handleUpdateRecipeServings('r-1', demande) })
      expect(mockBatch.mock.calls[0][0][0].recipe_servings, `demande ${demande}`).toBe(attendu)
    }
  })

  it('complète les valeurs initiales manquantes sur un ancien article', async () => {
    const ancien = { id: 'i-9', recipe_id: 'r-1', amount: 100, recipe_servings: 2, price: 3 }
    const r = monter([ancien])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 4) })
    const maj = mockBatch.mock.calls[0][0][0]
    expect(maj.amount_initial).toBe(100)
    expect(maj.recipe_servings_initial).toBe(2)
  })

  it('ne touche à rien si aucune ligne ne correspond à la recette', async () => {
    const r = monter([{ ...article, recipe_id: 'autre' }])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 4) })
    expect(mockBatch).not.toHaveBeenCalled()
  })
})
