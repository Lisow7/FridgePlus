import { describe, it, expect } from 'vitest'
import { parentIdsInStock } from '@shared/lib/fridge/parent-stock'

// groupMap : parentId → [enfants]. Une clé = une catégorie non sélectionnable.
const groupMap = {
  'fr-fromage': ['fr-comte', 'fr-brie'],
  'vg-tomate': ['vg-tomate-cerise'],
}

describe('parentIdsInStock', () => {
  it('repère les ids parents (catégories) présents dans le stock', () => {
    const stock = new Set(['fr-fromage', 'fr-comte', 'vg-tomate', 'fr-saumon'])
    expect(parentIdsInStock(stock, groupMap).sort()).toEqual(['fr-fromage', 'vg-tomate'])
  })

  it('renvoie [] si aucun parent (que des enfants/standalone)', () => {
    expect(parentIdsInStock(new Set(['fr-comte', 'fr-saumon']), groupMap)).toEqual([])
  })

  it('accepte un tableau autant qu\'un Set', () => {
    expect(parentIdsInStock(['fr-fromage'], groupMap)).toEqual(['fr-fromage'])
  })

  it('robuste : groupMap absent → [] (pas de crash)', () => {
    expect(parentIdsInStock(new Set(['fr-fromage']), null)).toEqual([])
    expect(parentIdsInStock(new Set(['fr-fromage']), undefined)).toEqual([])
  })

  it('robuste : stock vide / nul → []', () => {
    expect(parentIdsInStock(new Set(), groupMap)).toEqual([])
    expect(parentIdsInStock(null, groupMap)).toEqual([])
  })
})
