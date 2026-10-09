import { describe, it, expect } from 'vitest'
import { buildTermMatcher, splitTextWithMatcher } from '@shared/lib/recipes/text-term-matcher'

const ENTRIES = [
  { formId: 'a', kind: 'glossary', forms: ['émincer', 'émincez'], payload: { def: 'couper fin' } },
  { formId: 'b', kind: 'link', forms: ['béchamel'], payload: ['bechamel-maison'] },
  { formId: 'c', kind: 'glossary', forms: ['sauce tomate'], payload: { def: 'sauce' } },
]

describe('buildTermMatcher + splitTextWithMatcher', () => {
  it('texte sans terme → un seul segment text', () => {
    const matcher = buildTermMatcher(ENTRIES)
    expect(splitTextWithMatcher('Rien à signaler.', matcher)).toEqual([{ type: 'text', value: 'Rien à signaler.' }])
  })

  it('matche un terme et expose son kind/id/payload', () => {
    const matcher = buildTermMatcher(ENTRIES)
    const segs = splitTextWithMatcher("Émincer l'oignon.", matcher)
    const term = segs.find(s => s.type !== 'text')
    expect(term).toMatchObject({ type: 'glossary', value: 'Émincer', id: 'a' })
    expect(term.payload).toEqual({ def: 'couper fin' })
  })

  it('expressions multi-mots priment sur les sous-mots', () => {
    const matcher = buildTermMatcher(ENTRIES)
    const segs = splitTextWithMatcher('Verse la sauce tomate.', matcher)
    const terms = segs.filter(s => s.type !== 'text')
    expect(terms).toHaveLength(1)
    expect(terms[0].value).toBe('sauce tomate')
  })

  it('whole-word : pas de match intra-mot', () => {
    const matcher = buildTermMatcher(ENTRIES)
    const segs = splitTextWithMatcher('Je émincerais bien.', matcher)
    expect(segs.every(s => s.type === 'text')).toBe(true)
  })

  it('1 seule occurrence par formId, même terme répété', () => {
    const matcher = buildTermMatcher(ENTRIES)
    const segs = splitTextWithMatcher('Émincer puis émincer encore.', matcher)
    expect(segs.filter(s => s.type !== 'text')).toHaveLength(1)
  })

  it('précédence : dernière entrée insérée gagne sur collision exacte de forme', () => {
    const collidingEntries = [
      { formId: 'old', kind: 'glossary', forms: ['pesto'], payload: 'def' },
      { formId: 'new', kind: 'link', forms: ['pesto'], payload: ['pesto-maison'] },
    ]
    const matcher = buildTermMatcher(collidingEntries)
    const segs = splitTextWithMatcher('Ajoute du pesto.', matcher)
    const term = segs.find(s => s.type !== 'text')
    expect(term.id).toBe('new')
    expect(term.kind).toBe('link')
  })

  it('texte vide/undefined → segment vide sûr', () => {
    const matcher = buildTermMatcher(ENTRIES)
    expect(splitTextWithMatcher('', matcher)).toEqual([{ type: 'text', value: '' }])
    expect(splitTextWithMatcher(undefined, matcher)).toEqual([{ type: 'text', value: '' }])
  })

  it('aucune entrée → matcher sans regex, texte inchangé', () => {
    const matcher = buildTermMatcher([])
    expect(splitTextWithMatcher('Du texte.', matcher)).toEqual([{ type: 'text', value: 'Du texte.' }])
  })
})
