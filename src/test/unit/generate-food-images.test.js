// Tests pour le script generate-food-images.mjs (parseArgs + buildPrompt).
// Icons Overhaul P2 — fonctions pures testables sans API.

import { describe, it, expect } from 'vitest'
import { parseArgs, buildPrompt } from '../../../scripts/lib/image-prompts.mjs'

describe('parseArgs', () => {
  it('parse --type=ingredients', () => {
    expect(parseArgs(['node', 'script', '--type=ingredients'])).toEqual({ type: 'ingredients' })
  })

  it('parse plusieurs args', () => {
    const args = parseArgs(['node', 'script', '--type=recipes', '--limit=10', '--dry-run'])
    expect(args).toEqual({ type: 'recipes', limit: '10', 'dry-run': true })
  })

  it('parse --ids=csv', () => {
    expect(parseArgs(['node', 'script', '--ids=fr-tomate,sp-basilic'])).toEqual({ ids: 'fr-tomate,sp-basilic' })
  })

  it('ignore les args sans --', () => {
    expect(parseArgs(['node', 'script', 'positional', '--type=x'])).toEqual({ type: 'x' })
  })

  it('flag boolean sans valeur', () => {
    expect(parseArgs(['node', 'script', '--force'])).toEqual({ force: true })
  })
})

describe('buildPrompt — ingredients', () => {
  it('utilise label.en du item', () => {
    const item = { id: 'fr-tomate', labels: { en: 'Tomato', fr: 'Tomate' } }
    const prompt = buildPrompt('ingredients', item)
    expect(prompt).toContain('Tomato')
    expect(prompt).toContain('Flat 3D-soft icon')
    expect(prompt).toContain('transparent')
  })

  it('fallback sur labels.fr si labels.en absent', () => {
    const item = { id: 'fr-x', labels: { fr: 'Bidule' } }
    expect(buildPrompt('ingredients', item)).toContain('Bidule')
  })

  it('fallback sur id si pas de labels', () => {
    const item = { id: 'fr-mystery' }
    expect(buildPrompt('ingredients', item)).toContain('fr-mystery')
  })

  it('utilise override spécifique pour ID listé', () => {
    const item = { id: 'sp-basilic', labels: { en: 'Basil' } }
    const prompt = buildPrompt('ingredients', item)
    // Override doit overrider le template générique
    expect(prompt).toContain('basil leaves')
    expect(prompt).toContain('flat oval shape')
  })

  it('overrides pour les couples confus (persil ≠ basilic)', () => {
    const basilicPrompt = buildPrompt('ingredients', { id: 'sp-basilic', labels: { en: 'Basil' } })
    const persilPrompt  = buildPrompt('ingredients', { id: 'sp-persil',  labels: { en: 'Parsley' } })
    expect(basilicPrompt).not.toBe(persilPrompt)
    expect(persilPrompt).toContain('curly')
    expect(basilicPrompt).not.toContain('curly')
  })

  it('overrides de correspondance du lot 2026-08-26 (pita ≠ cookie, gnocchi striés)', () => {
    // Le pita avait été généré en forme de COOKIE : le trait identitaire
    // (la poche) et la négation explicite du défaut vu sont dans le prompt.
    const pita = buildPrompt('ingredients', { id: 'gp-pain-pita', labels: { en: 'Pita bread' } })
    expect(pita).toContain('pocket')
    expect(pita).toContain('NO cookie')
    const gnocchi = buildPrompt('ingredients', { id: 'gp-gnocchi', labels: { en: 'Gnocchi' } })
    expect(gnocchi).toContain('FORK RIDGE')
    // Nouvelle paire confuse, même famille que curcuma/gingembre.
    const galanga = buildPrompt('ingredients', { id: 'sp-galanga', labels: { en: 'Galangal' } })
    expect(galanga).toContain('rings')
    expect(galanga).toContain('paler and smoother than ginger')
  })

  it('overrides pour curcuma vs gingembre (cas confus, durcis)', () => {
    const curcumaPrompt    = buildPrompt('ingredients', { id: 'sp-curcuma',   labels: { en: 'Turmeric' } })
    const gingembrePrompt  = buildPrompt('ingredients', { id: 'sp-gingembre', labels: { en: 'Ginger' } })
    // Curcuma = POUDRE jaune-or pure, pas de rhizome
    expect(curcumaPrompt).toContain('YELLOW-GOLD')
    expect(curcumaPrompt).toContain('powder')
    expect(curcumaPrompt).toContain('no rhizome visible')
    // Gingembre = rhizome beige, pas de poudre, pas d'orange
    expect(gingembrePrompt).toContain('BEIGE-TAN')
    expect(gingembrePrompt).toContain('NO powder')
    expect(gingembrePrompt).toContain('NO orange tint')
  })
})

describe('buildPrompt — recipes', () => {
  it('RECIPE_OVERRIDES prime sur le gabarit générique (mécanisme des corrections post-audit)', async () => {
    const { RECIPE_OVERRIDES } = await import('../../../scripts/lib/image-prompts.mjs')
    RECIPE_OVERRIDES['test-plat'] = 'Prompt corrigé spécifique'
    try {
      expect(buildPrompt('recipes', { id: 'test-plat', name: { en: 'Test' } })).toBe('Prompt corrigé spécifique')
    } finally {
      delete RECIPE_OVERRIDES['test-plat']
    }
  })

  it('utilise name.en du item', () => {
    const item = { id: 'pates-tomate', name: { en: 'Tomato Pasta', fr: 'Pâtes tomate' } }
    const prompt = buildPrompt('recipes', item)
    expect(prompt).toContain('Tomato Pasta')
    expect(prompt).toContain('food photography')
  })

  it('fallback sur name.fr si name.en absent', () => {
    const item = { id: 'r1', name: { fr: 'Pâtes' } }
    expect(buildPrompt('recipes', item)).toContain('Pâtes')
  })
})

describe('buildPrompt — fridge', () => {
  it('utilise label_en', () => {
    const item = { id: 'fridge-freezer', label_en: 'freezer', label: 'Congélateur' }
    const prompt = buildPrompt('fridge', item)
    expect(prompt).toContain('freezer')
    expect(prompt).toContain('compartment')
  })
})

describe('buildPrompt — erreur type inconnu', () => {
  it('throws sur type non géré', () => {
    expect(() => buildPrompt('unknown', { id: 'x' })).toThrow(/Unknown type/)
  })
})
