import { describe, it, expect } from 'vitest'
import {
  buildLookup, buildFlatList, buildFuseIndex, buildGroupInfo, findMatches,
} from '@shared/lib/matching/ingredient-text-matcher'

// Données : un PARENT (fr-poisson, référencé comme group_id par des variantes)
// + ses variantes + un ingrédient standalone.
const INGREDIENTS = {
  poissons: [
    { id: 'fr-poisson',   labels: { fr: 'Poisson',   en: 'Fish' },   emoji: '🐟' },
    { id: 'fr-cabillaud', labels: { fr: 'Cabillaud', en: 'Cod' },    emoji: '🐟', group_id: 'fr-poisson' },
    { id: 'fr-saumon',    labels: { fr: 'Saumon',    en: 'Salmon' }, emoji: '🐟', group_id: 'fr-poisson' },
  ],
  legumes: [
    { id: 'fr-carotte',   labels: { fr: 'Carotte',   en: 'Carrot' }, emoji: '🥕' },
  ],
}

function indexes(lang = 'fr') {
  const flatList = buildFlatList(INGREDIENTS, lang)
  return {
    lookup: buildLookup(INGREDIENTS, lang),
    flatList,
    fuse: buildFuseIndex(flatList),
    groupInfo: buildGroupInfo(INGREDIENTS),
  }
}

describe('findMatches — catégories (parents) = guide, pas sélection', () => {
  it('buildGroupInfo détecte parents + variantes', () => {
    const gi = buildGroupInfo(INGREDIENTS)
    expect([...gi.parentIds]).toEqual(['fr-poisson'])
    expect(gi.childrenByParent.get('fr-poisson').map(c => c.id).sort())
      .toEqual(['fr-cabillaud', 'fr-saumon'])
  })

  it('dire un PARENT → pas d\'exact, mais désambiguïsation de ses variantes', () => {
    const { lookup, flatList, fuse, groupInfo } = indexes()
    const r = findMatches('poisson', 'fr', lookup, flatList, fuse, groupInfo)
    expect(r.exact.find(e => e.id === 'fr-poisson')).toBeUndefined()
    const amb = r.ambiguous.find(a => a.candidates?.some(c => c.id === 'fr-cabillaud'))
    expect(amb).toBeTruthy()
    expect(amb.candidates.map(c => c.id).sort()).toEqual(['fr-cabillaud', 'fr-saumon'])
  })

  it('dire une VARIANTE (enfant) → exact (pas de régression)', () => {
    const { lookup, flatList, fuse, groupInfo } = indexes()
    const r = findMatches('saumon', 'fr', lookup, flatList, fuse, groupInfo)
    expect(r.exact.map(e => e.id)).toContain('fr-saumon')
  })

  it('dire un STANDALONE → exact (pas de régression)', () => {
    const { lookup, flatList, fuse, groupInfo } = indexes()
    const r = findMatches('carotte', 'fr', lookup, flatList, fuse, groupInfo)
    expect(r.exact.map(e => e.id)).toContain('fr-carotte')
  })

  it('sans groupInfo → comportement historique inchangé (rétro-compat)', () => {
    const { lookup, flatList, fuse } = indexes()
    const r = findMatches('poisson', 'fr', lookup, flatList, fuse)
    expect(r.exact.map(e => e.id)).toContain('fr-poisson')
  })
})
