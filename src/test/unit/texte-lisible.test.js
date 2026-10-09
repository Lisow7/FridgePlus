import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'

// La brique des textes colorés lisibles (palette de l'admin, audit A11Y-03).
// Sa preuve visuelle est le garde-fou axe `a11y-admin` ; ici, sa forme, et la
// variable dont elle dépend — si index.css la perdait dans un thème, le
// mélange deviendrait invalide et le texte retomberait sur la couleur héritée.

describe('texteLisible', () => {
  it('mêle l’accent au charbon du thème, dans la part fixée par le thème', () => {
    expect(texteLisible('#16A34A')).toBe('color-mix(in srgb, #16A34A var(--part-accent-texte), var(--color-charcoal))')
    expect(texteLisible('var(--color-brand-500)')).toBe('color-mix(in srgb, var(--color-brand-500) var(--part-accent-texte), var(--color-charcoal))')
  })

  it('index.css fixe la part dans le thème clair ET dans le thème sombre', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const sombre = css.slice(css.indexOf('[data-theme="dark"] {'))
    const clair = css.slice(0, css.indexOf('[data-theme="dark"] {'))
    expect(clair).toMatch(/--part-accent-texte:\s*50%/)
    expect(sombre).toMatch(/--part-accent-texte:\s*35%/)
  })
})

describe('fondTeinte', () => {
  it('reste valide avec une variable CSS (`var(--…)18` ne l’était pas)', () => {
    expect(fondTeinte('var(--color-brand-500)')).toBe('color-mix(in srgb, var(--color-brand-500) 12%, transparent)')
    expect(fondTeinte('#2563EB', 20)).toBe('color-mix(in srgb, #2563EB 20%, transparent)')
  })
})
