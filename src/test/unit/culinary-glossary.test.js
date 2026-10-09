import { describe, it, expect } from 'vitest'
import { splitStepWithGlossary, CULINARY_GLOSSARY } from '@shared/lib/recipes/culinary-glossary'

const terms = (segs) => segs.filter((s) => s.type === 'term').map((s) => s.value)

describe('CULINARY_GLOSSARY (invariants)', () => {
  it('ids uniques + def fr/en + match.fr non vide', () => {
    const ids = CULINARY_GLOSSARY.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of CULINARY_GLOSSARY) {
      expect(e.def.fr).toBeTruthy()
      expect(e.def.en).toBeTruthy()
      expect(e.match.fr.length).toBeGreaterThan(0)
    }
  })
  it('au moins 30 termes', () => {
    expect(CULINARY_GLOSSARY.length).toBeGreaterThanOrEqual(30)
  })
})

describe('splitStepWithGlossary', () => {
  it('texte sans terme → un seul segment text', () => {
    const s = splitStepWithGlossary('Mélanger le tout.', 'fr')
    expect(s).toEqual([{ type: 'text', value: 'Mélanger le tout.' }])
  })
  it('matche un terme accentué (émincer) et expose sa définition', () => {
    const s = splitStepWithGlossary("Émincer l'oignon.", 'fr')
    expect(terms(s)).toEqual(['Émincer'])
    const term = s.find((x) => x.type === 'term')
    expect(term.id).toBe('emincer')
    expect(term.def.fr).toBeTruthy()
  })
  it('1ère occurrence seulement par terme', () => {
    const s = splitStepWithGlossary('Émincer puis émincer encore.', 'fr')
    expect(terms(s)).toEqual(['Émincer'])
    expect(s.map((x) => x.value).join('')).toBe('Émincer puis émincer encore.')
  })
  it('whole-word : pas de match intra-mot', () => {
    const s = splitStepWithGlossary('Je émincerais bien.', 'fr')
    expect(terms(s)).toEqual([])
  })
  it('préserve le texte original + matche plusieurs termes', () => {
    const txt = 'Blanchir les légumes puis déglacer au vinaigre.'
    const s = splitStepWithGlossary(txt, 'fr')
    expect(s.map((x) => x.value).join('')).toBe(txt)
    expect(terms(s).map((t) => t.toLowerCase())).toEqual(['blanchir', 'déglacer'])
  })
  it('anglais : matche un terme EN', () => {
    const s = splitStepWithGlossary('Sear the meat then deglaze.', 'en')
    expect(terms(s).map((t) => t.toLowerCase())).toContain('deglaze')
  })
  it('texte vide / undefined → segment vide sûr', () => {
    expect(splitStepWithGlossary('', 'fr')).toEqual([{ type: 'text', value: '' }])
    expect(splitStepWithGlossary(undefined, 'fr')).toEqual([{ type: 'text', value: '' }])
  })
})

describe('régressions termes composés / polysémie (2026-07-02)', () => {
  it('« bouquet garni » = un seul terme composé, pas « garni » → garnir', () => {
    const s = splitStepWithGlossary('Ajouter un bouquet garni et laisser mijoter.', 'fr')
    const t = s.filter((x) => x.type === 'term')
    expect(t.map((x) => x.value.toLowerCase())).toContain('bouquet garni')
    expect(t.map((x) => x.id)).toContain('bouquet-garni')
    expect(t.map((x) => x.id)).not.toContain('garnir')
  })
  it('« garni » seul (bien garni) reste rattaché à garnir', () => {
    const s = splitStepWithGlossary('Un plat bien garni.', 'fr')
    const t = s.filter((x) => x.type === 'term')
    expect(t.map((x) => x.id)).toContain('garnir')
  })
  it('« rectifier l’assaisonnement » = seulement « rectifier » (pas de double)', () => {
    const s = splitStepWithGlossary("Rectifier l'assaisonnement en sel et poivre.", 'fr')
    const ids = s.filter((x) => x.type === 'term').map((x) => x.id)
    expect(ids).toContain('rectifier')
    expect(ids).not.toContain('assaisonner')
  })
  it('« légère dorure » = coloration de cuisson (colorer), pas badigeon d’œuf', () => {
    const s = splitStepWithGlossary('Cuire jusqu’à légère dorure.', 'fr')
    const term = s.find((x) => x.type === 'term' && x.value.toLowerCase() === 'dorure')
    expect(term).toBeTruthy()
    expect(term.id).toBe('colorer')
    expect(CULINARY_GLOSSARY.some((e) => e.id === 'dorure')).toBe(false)
  })
  it('« dorer » (verbe) reste correct et distinct', () => {
    const s = splitStepWithGlossary('Dorer les morceaux de bœuf sur toutes les faces.', 'fr')
    const term = s.find((x) => x.type === 'term')
    expect(term.id).toBe('dorer')
  })
  it('« coloration dorée » n’est pas un double (audit corpus)', () => {
    const s = splitStepWithGlossary('Frire jusqu’à coloration dorée.', 'fr')
    const ids = s.filter((x) => x.type === 'term').map((x) => x.id)
    expect(ids).toContain('dorer')       // « dorée » explique la notion
    expect(ids).not.toContain('colorer') // « coloration » n’est plus marqué → pas de double
  })
})
