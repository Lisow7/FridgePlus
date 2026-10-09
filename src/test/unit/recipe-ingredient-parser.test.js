import { describe, it, expect } from 'vitest'
import { parseIngredientLine, parseIngredientList } from '@shared/lib/recipes/recipe-ingredient-parser'

describe('parseIngredientLine — parser FR à règles (texte → {amount, unit, name})', () => {
  const cases = [
    ['200 g de farine',            { amount: 200, unit: 'g',     name: 'farine' }],
    ['2 oignons',                  { amount: 2,   unit: null,    name: 'oignons' }],
    ['3 œufs',                     { amount: 3,   unit: null,    name: 'œufs' }],
    ['½ bouquet de basilic frais', { amount: 0.5, unit: 'bouquet', name: 'basilic frais' }],
    ["3 c. à soupe d'huile d'olive", { amount: 3, unit: 'cs',   name: "huile d'olive" }],
    ['1 boîte de lait de coco',    { amount: 1,   unit: 'boîte', name: 'lait de coco' }],
    ['1,5 kg de pommes de terre',  { amount: 1.5, unit: 'kg',    name: 'pommes de terre' }],
    ['1/2 citron',                 { amount: 0.5, unit: null,    name: 'citron' }],
    ['sel',                        { amount: null, unit: null,   name: 'sel' }],
    ['2 gousses d’ail',            { amount: 2,   unit: 'gousse', name: 'ail' }],
    ['25 cl de crème',            { amount: 25,  unit: 'cl',    name: 'crème' }],
    ['1 pincée de sel',            { amount: 1,   unit: 'pincée', name: 'sel' }],
  ]
  it.each(cases)('parse « %s »', (input, expected) => {
    expect(parseIngredientLine(input)).toMatchObject(expected)
  })

  it('conserve le texte brut dans `raw`', () => {
    expect(parseIngredientLine('  200 g de farine  ').raw).toBe('200 g de farine')
  })

  it('ligne vide → null', () => {
    expect(parseIngredientLine('')).toBeNull()
    expect(parseIngredientLine('   ')).toBeNull()
  })
})

describe('parseIngredientList — multi-lignes (collage)', () => {
  it('découpe par saut de ligne, virgule et puces, ignore le vide', () => {
    const txt = '200 g de farine\n2 oignons\n\n- 3 œufs'
    const r = parseIngredientList(txt)
    expect(r).toHaveLength(3)
    expect(r[0]).toMatchObject({ amount: 200, unit: 'g', name: 'farine' })
    expect(r[2]).toMatchObject({ amount: 3, name: 'œufs' })
  })

  it('gère la séparation par virgules sur une seule ligne', () => {
    const r = parseIngredientList('2 oignons, 200 g de farine, sel')
    expect(r).toHaveLength(3)
    expect(r[1]).toMatchObject({ amount: 200, unit: 'g', name: 'farine' })
  })
})
