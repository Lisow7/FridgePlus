import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { renderHook, act } from '@testing-library/react'

// `features/cart/hooks/use-cart-actions.js` — 0 % de lignes exécutées avant ce
// fichier (mesure du 2026-08-28), pour 73 lignes qui écrivent en base et
// calculent des prix.
//
// ── Ce qu'il faut vraiment protéger ──────────────────────────────────────
// 1. LE CALCUL SANS DÉRIVE du stepper « personnes ». Le module documente un bug
//    corrigé : le prix était mis à l'échelle depuis le prix COURANT, donc il se
//    composait à chaque changement, tandis que la quantité repartait de
//    `amount_initial` et ne dérivait pas — les deux se désynchronisaient.
//    Un aller-retour 2 → 4 → 2 doit rendre EXACTEMENT les valeurs de départ.
// 2. « J'AI FAIT MES COURSES » ne touche QUE les articles cochés. Inverser la
//    condition supprimerait du panier ce que l'utilisateur n'a pas acheté, sans
//    le mettre au frigo.
// 3. Le garde anti-doublon : ajouter deux fois la même recette au panier.

const mockAdd    = vi.hoisted(() => vi.fn())
const mockClear  = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())
const mockBatch  = vi.hoisted(() => vi.fn())
const mockUpsert = vi.hoisted(() => vi.fn())
const mockFrom   = vi.hoisted(() => vi.fn())

vi.mock('@features/cart/api/basket', () => ({
  addBasketItems:        (...a) => mockAdd(...a),
  clearBasket:           (...a) => mockClear(...a),
  removeBasketItemsByIds:(...a) => mockRemove(...a),
  updateBasketItemsBatch:(...a) => mockBatch(...a),
}))
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))
// Déterministes : on teste l'arithmétique du hook, pas celle des tables de prix.
vi.mock('@shared/lib/recipes/recipe-utils', () => ({ toGrams: (n) => (n ?? 0) * 1 }))
vi.mock('@shared/lib/pricing/open-prices', () => ({ getEmbeddedPrice: () => 2 })) // 2 € / 100 g

import { useCartActions } from '@features/cart/hooks/use-cart-actions'

const USER = { id: 'u-1' }
const rafraichir = vi.fn()

function monter(panier = [], stock = new Set()) {
  return renderHook(() => useCartActions({
    user: USER, basket: panier, stock, lang: 'fr',
    ingredientsById: new Map([['fr-tomate', { id: 'fr-tomate' }]]),
    refreshBasket: rafraichir,
  })).result
}

beforeEach(() => {
  for (const m of [mockAdd, mockClear, mockRemove, mockBatch, mockUpsert, mockFrom, rafraichir]) m.mockReset()
  mockAdd.mockResolvedValue({ error: null })
  mockClear.mockResolvedValue({ error: null, deletedCount: 0 })
  mockRemove.mockResolvedValue({ error: null })
  mockBatch.mockResolvedValue({ error: null })
  mockUpsert.mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({ upsert: mockUpsert })
})

describe('Stepper « personnes » — le calcul ne doit pas dériver', () => {
  // L'article de départ : 4 personnes, 200 g, 4 €.
  const article = {
    id: 'i-1', recipe_id: 'r-1', amount: 200, amount_initial: 200,
    recipe_servings: 4, recipe_servings_initial: 4, price: 4,
  }

  it('🔴 un aller-retour 4 → 2 → 4 rend EXACTEMENT les valeurs de départ', async () => {
    // Le défaut corrigé composait le prix à chaque passage : 4 € devenait 2 €
    // puis 1 € au lieu de revenir à 4 €, pendant que la quantité, elle,
    // repartait bien de `amount_initial`. Les deux se désynchronisaient.
    let courant = article

    // 4 → 2
    let r = monter([courant])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 2) })
    let maj = mockBatch.mock.calls[0][0][0]
    expect(maj.amount).toBe(100)
    expect(maj.price).toBe(2)

    // On rejoue l'état tel que la base le renverrait.
    courant = { ...courant, amount: maj.amount, price: maj.price, recipe_servings: 2 }
    mockBatch.mockClear()

    // 2 → 4 : retour au point de départ, au centime et au gramme près.
    r = monter([courant])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 4) })
    maj = mockBatch.mock.calls[0][0][0]
    expect(maj.amount, 'la quantité a dérivé').toBe(200)
    expect(maj.price, 'le prix a dérivé').toBe(4)
  })

  it('la quantité repart des valeurs INITIALES, pas des courantes', async () => {
    // Un article dont la quantité courante a été modifiée à la main : le calcul
    // doit ignorer cette valeur et repartir de `amount_initial`.
    const r = monter([{ ...article, amount: 999 }])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 8) })
    expect(mockBatch.mock.calls[0][0][0].amount).toBe(400) // 200 × 8/4
  })

  it('borne le nombre de personnes entre 1 et 12', async () => {
    for (const [demande, attendu] of [[0, 1], [-5, 1], [13, 12], [999, 12], [2.4, 2]]) {
      mockBatch.mockClear()
      const r = monter([article])
      await act(async () => { await r.current.handleUpdateRecipeServings('r-1', demande) })
      expect(mockBatch.mock.calls[0][0][0].recipe_servings, `demande ${demande}`).toBe(attendu)
    }
  })

  it('complète les valeurs initiales manquantes sur un ancien article', async () => {
    // Articles créés avant l'ajout de ces colonnes : le hook doit les semer.
    const ancien = { id: 'i-9', recipe_id: 'r-1', amount: 100, recipe_servings: 2, price: 3 }
    const r = monter([ancien])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 4) })
    const maj = mockBatch.mock.calls[0][0][0]
    expect(maj.amount_initial).toBe(100)
    expect(maj.recipe_servings_initial).toBe(2)
  })

  it('n\'écrase PAS les valeurs initiales déjà présentes', async () => {
    const r = monter([article])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 6) })
    const maj = mockBatch.mock.calls[0][0][0]
    expect(maj).not.toHaveProperty('amount_initial')
    expect(maj).not.toHaveProperty('recipe_servings_initial')
  })

  it('ne touche à rien si aucune ligne ne correspond à la recette', async () => {
    const r = monter([{ ...article, recipe_id: 'autre' }])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 4) })
    expect(mockBatch).not.toHaveBeenCalled()
  })

  it('un prix absent le reste, sans devenir « NaN »', async () => {
    const r = monter([{ ...article, price: null }])
    await act(async () => { await r.current.handleUpdateRecipeServings('r-1', 2) })
    expect(mockBatch.mock.calls[0][0][0].price).toBeNull()
  })
})

describe('« J\'ai fait mes courses » — seuls les articles COCHÉS sont traités', () => {
  const panier = [
    { id: 'i-1', ingredient_id: 'fr-tomate',    checked: true },
    { id: 'i-2', ingredient_id: 'gp-farine',    checked: false },
    { id: 'i-3', ingredient_id: 'fr-tomate',    checked: true },  // doublon d'ingrédient
    { id: 'i-4', ingredient_id: 'vg-carotte',   checked: true },
  ]

  it('🔴 ne met au frigo QUE les ingrédients cochés, dédoublonnés', async () => {
    const r = monter()
    await act(async () => { await r.current.handleCompleteShopping(panier) })

    const lignes = mockUpsert.mock.calls[0][0]
    expect(lignes.map(l => l.ingredient_id).sort()).toEqual(['fr-tomate', 'vg-carotte'])
    expect(lignes.every(l => l.user_id === 'u-1')).toBe(true)
  })

  it('🔴 ne retire du panier QUE les articles cochés', async () => {
    const r = monter()
    const res = await act(async () => r.current.handleCompleteShopping(panier))

    // L'article non coché doit SURVIVRE : l'utilisateur ne l'a pas acheté, il
    // le retrouvera à sa prochaine sortie.
    expect(mockRemove).toHaveBeenCalledWith(['i-1', 'i-3', 'i-4'])
    expect(res).toEqual({ error: null, addedToFridge: 2 })
  })

  it('ignore les doublons côté base plutôt que d\'échouer sur un ingrédient déjà au frigo', async () => {
    const r = monter()
    await act(async () => { await r.current.handleCompleteShopping(panier) })
    expect(mockUpsert.mock.calls[0][1]).toEqual({
      onConflict: 'user_id,ingredient_id', ignoreDuplicates: true,
    })
  })

  it('ne touche à rien quand aucun article n\'est coché', async () => {
    const r = monter()
    const res = await act(async () => r.current.handleCompleteShopping([
      { id: 'i-1', ingredient_id: 'fr-tomate', checked: false },
    ]))
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
    expect(res.addedToFridge).toBe(0)
  })

  it('refuse sans utilisateur connecté', async () => {
    const r = renderHook(() => useCartActions({ user: null, basket: [], lang: 'fr', ingredientsById: new Map(), refreshBasket: rafraichir })).result
    const res = await act(async () => r.current.handleCompleteShopping(panier))
    expect(res).toEqual({ error: { message: 'not_authenticated' } })
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('Ajout d\'une recette au panier', () => {
  const recette = {
    id: 'r-1', emoji: '🍅', servings: 2,
    ingredients: [
      { required: true,  ids: ['fr-tomate'], qty: { amount: 100, unit: 'g' }, labels: { fr: 'Tomate' } },
      { required: false, ids: ['sp-sel'],    qty: { amount: 5,   unit: 'g' }, labels: { fr: 'Sel' } },
      { required: true,  ids: [],            qty: { amount: 50,  unit: 'g' }, labels: { fr: 'Sans id' } },
    ],
  }

  it('refuse d\'ajouter deux fois la même recette', async () => {
    const r = monter([{ recipe_id: 'r-1' }])
    const res = await act(async () => r.current.handleAddToCart(recette))
    expect(res).toBe('duplicate')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('ne retient que les ingrédients requis ET identifiables', async () => {
    const r = monter()
    await act(async () => { await r.current.handleAddToCart(recette) })
    const lignes = mockAdd.mock.calls[0][1]
    expect(lignes).toHaveLength(1)
    expect(lignes[0].ingredient_id).toBe('fr-tomate')
  })

  it('met quantité ET prix à l\'échelle du nombre de personnes choisi', async () => {
    const r = monter()
    await act(async () => { await r.current.handleAddToCart(recette, 4) }) // 2 → 4 personnes
    const ligne = mockAdd.mock.calls[0][1][0]
    expect(ligne.amount).toBe(200)              // 100 g × 2
    expect(ligne.price).toBe(4)                 // 2 €/100 g × 100 g × 2
    expect(ligne.recipe_servings).toBe(4)
    expect(ligne.amount_initial).toBe(200)      // le point de référence anti-dérive
  })

  it('annonce « tout est au frigo » quand il ne reste rien à ajouter', async () => {
    const r = monter()
    const res = await act(async () => r.current.handleAddToCart({ id: 'r-2', servings: 1, ingredients: [] }))
    expect(res).toBe('all_in_fridge')
  })

  // ── Arbitrage du 2026-08-28 ────────────────────────────────────────────
  // Ce bloc figeait auparavant le comportement INVERSE, en attendant une
  // décision produit. Elle est prise : le panier ne doit contenir que ce qui
  // MANQUE — c'est la promesse de l'application.
  //
  // Le filtre existait dans `app/hooks/use-basket-actions.js` (page d'accueil)
  // et avait été perdu dans cette copie, faute de recevoir le stock : la
  // condition s'écrivait `(ignoreStock || true)`, toujours vraie. Le même geste
  // sur la même recette donnait donc un panier différent selon l'écran de
  // départ, et le message « tout est au frigo » ne pouvait pas dire vrai ici.
  it('🔴 écarte du panier les ingrédients déjà au frigo', async () => {
    const r = monter([], new Set(['fr-tomate']))
    const res = await act(async () => r.current.handleAddToCart(recette))

    // La tomate est le seul ingrédient requis et identifiable de la recette :
    // si elle est au frigo, il ne reste rien à acheter.
    expect(res).toBe('all_in_fridge')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('`ignoreStock` passe outre le frigo — pour les écrans de suggestions', async () => {
    // `cart-suggestions-modal` et `empty-basket-recipe-ideas` le demandent
    // explicitement : on y explore des recettes, on veut la liste entière.
    const r = monter([], new Set(['fr-tomate']))
    await act(async () => { await r.current.handleAddToCart(recette, 2, { ignoreStock: true }) })
    expect(mockAdd.mock.calls[0][1].map(l => l.ingredient_id)).toEqual(['fr-tomate'])
  })

  it('un frigo vide ne retire rien', async () => {
    const r = monter([], new Set())
    await act(async () => { await r.current.handleAddToCart(recette) })
    expect(mockAdd.mock.calls[0][1]).toHaveLength(1)
  })
})

describe('Chargement d\'une liste enregistrée', () => {
  it('⚠️ VIDE le panier avant d\'insérer — sans retour en arrière si l\'insertion échoue', async () => {
    // Constat documenté : la suppression précède l'ajout et rien ne restaure le
    // panier si l'insertion échoue. L'utilisateur perd alors son panier ET
    // n'obtient pas la liste. Figé ici pour que le risque soit visible.
    mockAdd.mockResolvedValue({ error: { message: 'réseau' } })
    const r = monter()
    const res = await act(async () => r.current.handleLoadList([{ ingredient_id: 'fr-tomate' }]))

    expect(mockClear).toHaveBeenCalledWith('u-1')
    expect(res.error).toEqual({ message: 'réseau' })
    expect(rafraichir).not.toHaveBeenCalled()
  })

  it('le vidage est refusé : rien n’est ajouté, l’erreur est rendue', async () => {
    // Le résultat du vidage était jeté : la liste s'ajoutait PAR-DESSUS l'ancien
    // panier, et l'écran annonçait la liste chargée (relevé au lot 14c,
    // 2026-10-08).
    mockClear.mockResolvedValue({ error: { message: 'réseau' }, deletedCount: 0 })
    const r = monter()
    const res = await act(async () => r.current.handleLoadList([{ ingredient_id: 'fr-tomate' }]))
    expect(res.error).toEqual({ message: 'réseau' })
    expect(mockAdd).not.toHaveBeenCalled()
    expect(rafraichir).not.toHaveBeenCalled()
  })

  it('une liste vide vide le panier sans insérer', async () => {
    const r = monter()
    const res = await act(async () => r.current.handleLoadList([]))
    expect(mockClear).toHaveBeenCalledWith('u-1')
    expect(mockAdd).not.toHaveBeenCalled()
    expect(res).toEqual({ error: null })
  })

  it('applique les valeurs par défaut des champs absents', async () => {
    const r = monter()
    await act(async () => { await r.current.handleLoadList([{ ingredient_id: 'fr-tomate' }]) })
    expect(mockAdd.mock.calls[0][1][0]).toMatchObject({
      label: '', amount: 1, unit: 'pcs', price: null, checked: false,
    })
  })

  it('refuse autre chose qu\'une liste', async () => {
    const r = monter()
    const res = await act(async () => r.current.handleLoadList('pas une liste'))
    expect(res).toEqual({ error: { message: 'invalid_args' } })
    expect(mockClear).not.toHaveBeenCalled()
  })
})

describe('Ajout manuel et retrait par ingrédient', () => {
  it('refuse un ajout sans ingrédient', async () => {
    const r = monter()
    expect(await act(async () => r.current.handleManualAdd({})))
      .toEqual({ error: { message: 'invalid_args' } })
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('ajoute une ligne hors recette avec ses valeurs par défaut', async () => {
    const r = monter()
    await act(async () => { await r.current.handleManualAdd({ ingredient_id: 'fr-tomate' }) })
    expect(mockAdd.mock.calls[0][1][0]).toMatchObject({
      recipe_id: null, ingredient_id: 'fr-tomate', amount: 1, unit: 'pcs',
    })
  })

  it('retire toutes les lignes d\'un même ingrédient, quelle que soit leur recette', async () => {
    const r = monter([
      { id: 'i-1', ingredient_id: 'fr-tomate' },
      { id: 'i-2', ingredient_id: 'gp-farine' },
      { id: 'i-3', ingredient_id: 'fr-tomate' },
    ])
    const res = await act(async () => r.current.handleRemoveAllByIngredient('fr-tomate'))
    expect(mockRemove).toHaveBeenCalledWith(['i-1', 'i-3'])
    expect(res).toEqual({ error: null, removed: 2 })
  })

  it('ne fait rien si l\'ingrédient n\'est pas au panier', async () => {
    const r = monter([{ id: 'i-1', ingredient_id: 'gp-farine' }])
    const res = await act(async () => r.current.handleRemoveAllByIngredient('fr-tomate'))
    expect(mockRemove).not.toHaveBeenCalled()
    expect(res).toEqual({ error: null, removed: 0 })
  })
})

// Le filtre du frigo est-il réellement BRANCHÉ ?
//
// 🔴 Les tests ci-dessus prouvent que le hook filtre QUAND on lui donne le
// stock. Ils ne prouvent pas qu'on le lui donne. C'est exactement l'angle mort
// qui a laissé le plafond budgétaire IA débranché trois mois : la logique était
// juste, personne ne l'appelait, et rien ne le signalait — « supprimer un appel
// ne casse rien ».
//
// Ce bloc lit donc les VRAIS appelants. Un futur écran qui oublierait `stock`
// retomberait en silence dans le défaut corrigé ici : son panier se remplirait
// de ce que l'utilisateur possède déjà.
describe('Le filtre du frigo est-il branché ?', () => {
  const APPELANTS = [
    'src/features/recipes/pages/recipe-page.jsx',
    'src/features/cart/pages/cart-page.jsx',
    // L'accueil délègue désormais au panier unique (audit ARCH-07, lot 14c) :
    // il doit donc, lui aussi, passer le stock à ce hook.
    'src/app/hooks/use-basket-actions.js',
  ]

  // ⚠️ Chemin construit depuis `process.cwd()`, PAS depuis `import.meta.url` :
  // sous l'environnement jsdom de Vitest, `import.meta.url` n'est pas une URL
  // `file:` et `fileURLToPath` lève « The URL must be of scheme file ».
  const lire = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8')

  for (const chemin of APPELANTS) {
    it(`${chemin.split('/').pop()} passe stock au hook`, () => {
      const args = /useCartActions\(\{([^}]*)/.exec(lire(chemin))?.[1] ?? ''
      expect(
        /\bstock\b/.test(args),
        `${chemin} appelle useCartActions sans lui passer stock : le filtre du `
        + 'frigo ne retirera plus rien et le panier se remplira de ce que '
        + "l'utilisateur possède déjà. Arguments trouvés : " + JSON.stringify(args.replace(/\s+/g, ' ')),
      ).toBe(true)
    })
  }

  it('aucun appelant nouveau ne passe entre les mailles', () => {
    // Si un troisième écran se met à utiliser ce hook, ce test le signale au
    // lieu de le laisser filer sans vérification.
    const racine = resolve(process.cwd(), 'src')
    const trouves = []
    const parcourir = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name)
        if (e.isDirectory()) { if (!p.includes('test')) parcourir(p) }
        else if (/\.jsx?$/.test(e.name) && readFileSync(p, 'utf8').includes('useCartActions(')) {
          trouves.push(p.slice(p.indexOf('src')).split(sep).join('/'))
        }
      }
    }
    parcourir(racine)
    const appelants = trouves.filter(p => !p.includes('hooks/use-cart-actions'))
    expect(appelants.sort()).toEqual([...APPELANTS].sort())
  })
})
