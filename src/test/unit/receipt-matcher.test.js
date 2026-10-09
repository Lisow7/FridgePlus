import { describe, it, expect } from 'vitest'
import { matchReceiptLabels } from '../../features/receipt-scan/lib/receipt-matcher.js'

const INGREDIENTS = {
  vegetables: [{ id: 'vg-tomate', labels: { fr: 'Tomate' }, emoji: '🍅' }],
  bof: [
    { id: 'fr-jambon-blanc', labels: { fr: 'Jambon blanc' }, emoji: '🍖' },
    { id: 'fr-jambon-cru', labels: { fr: 'Jambon cru' }, emoji: '🥓' },
    { id: 'fr-fromage-comte', labels: { fr: 'Fromage comté' }, emoji: '🧀' },
    { id: 'fr-fromage-emmental', labels: { fr: 'Fromage emmental' }, emoji: '🧀' },
  ],
}

describe('matchReceiptLabels', () => {
  it('classe un libellé exact en matched', async () => {
    const result = await matchReceiptLabels(['TOMATE'], { lang: 'fr', ingredients: INGREDIENTS })
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].id).toBe('vg-tomate')
    expect(result.unmatchedCount).toBe(0)
  })

  it('classe un libellé ambigu (2 candidats) en ambiguous, sans citer le texte brut', async () => {
    const result = await matchReceiptLabels(['JAMBON'], { lang: 'fr', ingredients: INGREDIENTS })
    expect(result.matched).toHaveLength(0)
    expect(result.ambiguous).toHaveLength(1)
    expect(result.ambiguous[0].candidates.map(c => c.id).sort()).toEqual(['fr-jambon-blanc', 'fr-jambon-cru'])
  })

  it('compte les libellés non reconnus sans les exposer', async () => {
    const result = await matchReceiptLabels(['PRODUIT INCONNU XYZ'], { lang: 'fr', ingredients: INGREDIENTS })
    expect(result.matched).toHaveLength(0)
    expect(result.ambiguous).toHaveLength(0)
    expect(result.unmatchedCount).toBe(1)
    expect(JSON.stringify(result)).not.toContain('PRODUIT INCONNU XYZ')
  })

  it('déduplique les mêmes ingrédients matchés sur plusieurs lignes', async () => {
    const result = await matchReceiptLabels(['TOMATE', 'TOMATE'], { lang: 'fr', ingredients: INGREDIENTS })
    expect(result.matched).toHaveLength(1)
  })

  it('conserve un match exact ET une ambiguïté simultanés dans le même libellé', async () => {
    const result = await matchReceiptLabels(['TOMATE JAMBON'], { lang: 'fr', ingredients: INGREDIENTS })
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].id).toBe('vg-tomate')
    expect(result.ambiguous).toHaveLength(1)
    expect(result.ambiguous[0].candidates.map(c => c.id).sort()).toEqual(['fr-jambon-blanc', 'fr-jambon-cru'])
    expect(result.unmatchedCount).toBe(0)
  })

  it('conserve plusieurs groupes ambigus distincts dans le même libellé', async () => {
    const result = await matchReceiptLabels(['JAMBON FROMAGE'], { lang: 'fr', ingredients: INGREDIENTS })
    expect(result.matched).toHaveLength(0)
    expect(result.ambiguous).toHaveLength(2)
    const allCandidateIds = result.ambiguous.flatMap(a => a.candidates.map(c => c.id)).sort()
    expect(allCandidateIds).toEqual(['fr-fromage-comte', 'fr-fromage-emmental', 'fr-jambon-blanc', 'fr-jambon-cru'])
  })
})
