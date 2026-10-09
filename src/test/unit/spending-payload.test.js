import { describe, it, expect } from 'vitest'
import { buildSpendingPayload } from '@features/cart/lib/spending-payload'

describe('buildSpendingPayload', () => {
  it('construit total + items_json depuis les articles cochés', () => {
    const out = buildSpendingPayload([
      { ingredient_id: 'vg-tomate', amount: 500, unit: 'g', price: 1.2 },
      { ingredient_id: 'fr-baguette', amount: 1, unit: 'pcs', price: 0.9 },
    ])
    expect(out.items_count).toBe(2)
    expect(out.total_eur).toBe(2.1)
    expect(out.items_json).toEqual([
      { id: 'vg-tomate', qty: 500, unit: 'g', unit_eur: 1.2 },
      { id: 'fr-baguette', qty: 1, unit: 'pcs', unit_eur: 0.9 },
    ])
  })

  it('tolère un prix absent (unit_eur=0) — événement quand même valide', () => {
    const out = buildSpendingPayload([
      { ingredient_id: 'fr-oeufs-standard', amount: 3, unit: 'pcs' },
    ])
    expect(out.items_count).toBe(1)
    expect(out.total_eur).toBe(0)
    expect(out.items_json[0]).toEqual({ id: 'fr-oeufs-standard', qty: 3, unit: 'pcs', unit_eur: 0 })
  })

  it('ignore les articles sans identifiant', () => {
    const out = buildSpendingPayload([
      { ingredient_id: null, amount: 1, unit: 'pcs', price: 5 },
      { id: 'gp-riz', amount: 200, unit: 'g', price: 0.5 },
    ])
    expect(out.items_count).toBe(1)
    expect(out.items_json[0].id).toBe('gp-riz')
  })

  it('liste vide → payload vide', () => {
    expect(buildSpendingPayload([])).toEqual({ total_eur: 0, items_count: 0, items_json: [] })
  })

  it('arrondit le total à 2 décimales', () => {
    const out = buildSpendingPayload([
      { ingredient_id: 'a', amount: 1, unit: 'pcs', price: 0.1 },
      { ingredient_id: 'b', amount: 1, unit: 'pcs', price: 0.2 },
    ])
    expect(out.total_eur).toBe(0.3)
  })
})
