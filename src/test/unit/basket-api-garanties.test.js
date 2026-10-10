import { describe, it, expect, vi, beforeEach } from 'vitest'

// `features/cart/api/basket.js` — 0 % de lignes exécutées avant ce fichier
// (mesure de couverture du 2026-08-28), pour un module qui ne fait presque que
// des suppressions.
//
// Ce qu'il faut protéger n'est pas « chaque fonction marche » mais les trois
// décisions que le code a prises et que rien ne tenait :
//
//   1. `clearBasket` ne se contente pas de supprimer : il demande `.select('id')`
//      pour COMPTER ce qui a réellement été effacé. Le commentaire du module dit
//      pourquoi — « RLS qui bloque sans erreur visible : DELETE retourne success
//      mais ne supprime aucune row ». Sans ce select, `deletedCount` vaut
//      toujours 0 et le détecteur de panne silencieuse est mort, sans que rien
//      ne casse.
//   2. Les suppressions ciblées sont FILTRÉES — par utilisateur ET par recette.
//      Un filtre perdu, et l'on efface plus que demandé.
//   3. Une liste d'identifiants vide ne part pas en base : `.in('id', [])` est
//      un aller-retour pour rien, et `.in('id', undefined)` est une inconnue
//      qu'on ne veut pas tester en production.

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))

import {
  loadBasketFromDB, addBasketItems, updateBasketItem, removeBasketItem,
  removeBasketByRecipe, clearBasket, removeBasketItemsByIds, updateBasketItemsBatch,
} from '@features/cart/api/basket'

// Chaîne supabase-js « thenable » : chaque maillon renvoie la chaîne, et
// l'attente résout la valeur finale. Même idiome que `reports.test.js`.
function chaine(valeur) {
  const c = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    in:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
  }
  c[Symbol.toStringTag] = 'Promise'
  c.then  = (res, rej) => Promise.resolve(valeur).then(res, rej)
  c.catch = (rej)      => Promise.resolve(valeur).catch(rej)
  return c
}

beforeEach(() => { mockFrom.mockReset() })

describe('clearBasket — le détecteur de suppression silencieuse', () => {
  it('🔴 demande les lignes supprimées et en rend le nombre', async () => {
    const c = chaine({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null })
    mockFrom.mockReturnValue(c)

    const res = await clearBasket('u-1')

    // Le `.select('id')` EST le mécanisme : sans lui, Supabase ne renvoie pas
    // les lignes effacées et le compte serait toujours nul.
    expect(c.select).toHaveBeenCalledWith('id')
    expect(c.eq).toHaveBeenCalledWith('user_id', 'u-1')
    expect(res).toEqual({ error: null, deletedCount: 3 })
  })

  it('rend un compte de ZÉRO quand la base répond « réussi » sans rien supprimer', async () => {
    // C'est exactement le symptôme décrit dans le module : session expirée en
    // silence, `auth.uid()` ne correspond plus à `user_id`, la RLS filtre tout,
    // et le DELETE réussit sans effet. L'appelant doit pouvoir le voir.
    mockFrom.mockReturnValue(chaine({ data: [], error: null }))
    expect(await clearBasket('u-1')).toEqual({ error: null, deletedCount: 0 })
  })

  it('rend un compte de zéro plutôt que de planter si la base ne renvoie pas de tableau', async () => {
    mockFrom.mockReturnValue(chaine({ data: null, error: null }))
    expect(await clearBasket('u-1')).toEqual({ error: null, deletedCount: 0 })
  })

  it('remonte l\'erreur au lieu d\'annoncer un vidage', async () => {
    mockFrom.mockReturnValue(chaine({ data: null, error: { message: 'boum' } }))
    const res = await clearBasket('u-1')
    expect(res.error).toEqual({ message: 'boum' })
    expect(res.deletedCount).toBe(0)
  })
})

describe('Suppressions ciblées — les filtres', () => {
  it('removeBasketByRecipe filtre sur l\'utilisateur ET la recette', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await removeBasketByRecipe('u-1', 'rec-9')

    // Perdre le filtre utilisateur viderait le panier d'autrui pour cette
    // recette (la RLS rattraperait, mais on ne s'en remet pas à elle seule) ;
    // perdre le filtre recette viderait tout le panier de l'utilisateur.
    expect(c.eq).toHaveBeenCalledWith('user_id', 'u-1')
    expect(c.eq).toHaveBeenCalledWith('recipe_id', 'rec-9')
    expect(c.eq).toHaveBeenCalledTimes(2)
  })

  it('removeBasketItem cible un seul identifiant et remonte l\'erreur', async () => {
    const c = chaine({ error: { message: 'refus' } })
    mockFrom.mockReturnValue(c)
    const res = await removeBasketItem('i-1')
    expect(c.eq).toHaveBeenCalledWith('id', 'i-1')
    expect(res).toEqual({ error: { message: 'refus' } })
  })

  it('removeBasketItemsByIds n\'interroge PAS la base sur une liste vide', async () => {
    for (const vide of [[], null, undefined]) {
      mockFrom.mockReset()
      const res = await removeBasketItemsByIds(vide)
      expect(res).toEqual({ error: null })
      expect(mockFrom, `liste ${JSON.stringify(vide)} a déclenché une requête`).not.toHaveBeenCalled()
    }
  })

  it('removeBasketItemsByIds supprime bien la liste fournie', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await removeBasketItemsByIds(['a', 'b'])
    expect(c.in).toHaveBeenCalledWith('id', ['a', 'b'])
  })
})

describe('Écritures', () => {
  it('addBasketItems estampille CHAQUE ligne avec l\'utilisateur', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await addBasketItems('u-1', [{ name: 'tomate' }, { name: 'farine' }])

    // Une ligne sans `user_id` serait refusée par la RLS — ou pire, rattachée
    // au mauvais compte si un défaut la laissait passer.
    expect(c.insert).toHaveBeenCalledWith([
      { name: 'tomate', user_id: 'u-1' },
      { name: 'farine', user_id: 'u-1' },
    ])
  })

  it('updateBasketItem cible l\'article demandé', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await updateBasketItem('i-7', { amount: 3 })
    expect(c.update).toHaveBeenCalledWith({ amount: 3 })
    expect(c.eq).toHaveBeenCalledWith('id', 'i-7')
  })

  it('updateBasketItemsBatch n\'écrit PAS l\'identifiant dans les champs mis à jour', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await updateBasketItemsBatch([{ id: 'i-1', amount: 2, recipe_servings: 4 }])

    // `id` sert de cible, pas de valeur : l'écrire reviendrait à modifier une
    // clé primaire.
    expect(c.update).toHaveBeenCalledWith({ amount: 2, recipe_servings: 4 })
    expect(c.eq).toHaveBeenCalledWith('id', 'i-1')
  })

  it('updateBasketItemsBatch remonte la PREMIÈRE erreur rencontrée', async () => {
    const ok  = chaine({ error: null })
    const ko  = chaine({ error: { message: 'premier échec' } })
    const ko2 = chaine({ error: { message: 'second échec' } })
    mockFrom.mockReturnValueOnce(ok).mockReturnValueOnce(ko).mockReturnValueOnce(ko2)

    const res = await updateBasketItemsBatch([
      { id: 'a', amount: 1 }, { id: 'b', amount: 2 }, { id: 'c', amount: 3 },
    ])
    expect(res.error).toEqual({ message: 'premier échec' })
  })

  it('updateBasketItemsBatch ne rend aucune erreur quand tout passe', async () => {
    mockFrom.mockReturnValue(chaine({ error: null }))
    expect(await updateBasketItemsBatch([{ id: 'a', amount: 1 }])).toEqual({ error: null })
  })
})

describe('Lecture', () => {
  it('trie du plus ancien au plus récent, filtré sur l\'utilisateur', async () => {
    const c = chaine({ data: [{ id: 'a' }], error: null })
    mockFrom.mockReturnValue(c)
    const res = await loadBasketFromDB('u-1')
    expect(c.eq).toHaveBeenCalledWith('user_id', 'u-1')
    expect(c.order).toHaveBeenCalledWith('added_at', { ascending: true })
    expect(res).toEqual({ data: [{ id: 'a' }], error: null })
  })

  // Ce test DOCUMENTAIT une limite : une liste vide sur erreur, « aucune donnée
  // détruite puisque clearBasket supprime par user_id ». C'était faux : depuis
  // un panier qui paraît vide, « Reprendre une liste » vide le panier en base
  // sans confirmation — des lignes que personne n'a vues. Le chargement rend
  // désormais son erreur (audit du 2026-10-04, lot « le panier dit son échec »).
  it('un chargement raté rend son erreur — ce n\'est pas un panier vide', async () => {
    mockFrom.mockReturnValue(chaine({ data: null, error: { message: 'réseau' } }))
    expect(await loadBasketFromDB('u-1')).toEqual({ data: [], error: { message: 'réseau' } })
  })
})
