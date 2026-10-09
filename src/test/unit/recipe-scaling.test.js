import { describe, it, expect } from 'vitest'
import { scaleQuantities, scaleToServings } from '@shared/lib/recipes/recipe-scaling'

const ING = [
  { ids: ['vg-tomate'], qty: { amount: 200, unit: 'g' }, labels: { fr: '200 g tomates' }, required: true },
  { ids: ['vg-oignon'], qty: { amount: 2, unit: 'pcs' }, labels: { fr: '2 oignons' }, required: true },
  { ids: ['sp-sel'], qty: { amount: null, unit: '' }, labels: { fr: 'sel' }, required: false },
]

describe('scaleQuantities — recalcul proportionnel', () => {
  it('×2 double les quantités', () => {
    const r = scaleQuantities(ING, 2)
    expect(r[0].qty.amount).toBe(400)
    expect(r[1].qty.amount).toBe(4)
  })
  it('×0.5 divise', () => {
    expect(scaleQuantities(ING, 0.5)[0].qty.amount).toBe(100)
  })
  it('amount null reste null', () => {
    expect(scaleQuantities(ING, 3)[2].qty.amount).toBeNull()
  })
  it('préserve ids / unit / labels / required', () => {
    const r = scaleQuantities(ING, 2)
    expect(r[0]).toMatchObject({ ids: ['vg-tomate'], qty: { unit: 'g' }, labels: { fr: '200 g tomates' }, required: true })
  })
  it('immutable : ne mute pas la source', () => {
    const snap = JSON.parse(JSON.stringify(ING))
    scaleQuantities(ING, 2)
    expect(ING).toEqual(snap)
  })
  it('arrondi à 2 décimales', () => {
    expect(scaleQuantities([{ qty: { amount: 100 } }], 1 / 3)[0].qty.amount).toBe(33.33)
  })
})

describe('scaleToServings', () => {
  it('de 4 à 8 portions = ×2', () => {
    expect(scaleToServings(ING, 4, 8)[0].qty.amount).toBe(400)
  })
  it('from/to invalides → inchangé', () => {
    expect(scaleToServings(ING, 0, 8)).toEqual(ING)
    expect(scaleToServings(ING, 4, 0)).toEqual(ING)
  })
})
