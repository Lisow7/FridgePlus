/**
 * La carte recette doit dire la même chose que le pourcentage (signalé le 2026-10-02) :
 * « Pâte à choux » à 67 % affichait beurre ET œufs en rouge, parce que la carte
 * comparait le stock brut alors que le score passe par `expandStock` (variantes)
 * et compte les basiques de placard comme présents.
 */
import { describe, it, expect } from 'vitest'
import { scoreRecipes, splitPresentMissing } from '@shared/lib/recipes/recipe-scoring'

const choux = {
  id: 'choux',
  ingredients: [
    { ids: ['fr-beurre'], labels: { fr: 'Beurre' }, required: true },
    { ids: ['gp-farine'], labels: { fr: 'Farine' }, required: true },
    { ids: ['fr-oeuf'],   labels: { fr: 'Œufs' },   required: true },
    { ids: ['sp-sel'],    labels: { fr: 'Sel' },    required: true },
  ],
}
// « Beurre doux » et « Œufs standards » sont des variantes des parents de la recette
const groupMaps = {
  groupMap:  { 'fr-beurre': ['fr-beurre-doux'], 'fr-oeuf': ['fr-oeufs-standards'] },
  parentMap: { 'fr-beurre-doux': 'fr-beurre', 'fr-oeufs-standards': 'fr-oeuf' },
}
const stock = new Set(['fr-beurre-doux', 'fr-oeufs-standards'])
const noms = items => items.map(i => i.labels.fr)

describe('carte recette — même verdict que le score', () => {
  it('une variante en stock compte comme présente, comme dans le pourcentage', () => {
    const [scored] = scoreRecipes([choux], stock, groupMaps, new Set(['sp-sel']))
    const { present, missing } = splitPresentMissing(scored, stock)
    expect(noms(missing)).toEqual(['Farine'])
    expect(noms(present)).toEqual(['Beurre', 'Œufs', 'Sel'])
    expect(present.length / (present.length + missing.length)).toBe(scored.matchPercent)
  })

  it('sans score (recette brute), retombe sur le stock tel quel', () => {
    const { present, missing } = splitPresentMissing(choux, new Set(['gp-farine']))
    expect(noms(present)).toEqual(['Farine'])
    expect(noms(missing)).toEqual(['Beurre', 'Œufs', 'Sel'])
  })
})
