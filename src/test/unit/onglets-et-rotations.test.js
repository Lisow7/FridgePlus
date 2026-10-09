import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

// Deux garde-fous nés de l'audit du 2026-10-04 (A11Y-10), sur TOUT `src/` :
//
// 1. Un `role="tab"` sans `role="tablist"` dans le même fichier. Le panneau
//    admin en avait 14, le guide intégré et la Qualité les leurs : un lecteur
//    d'écran annonce « onglet 1 sur 14 » à partir de la liste — sans elle, le
//    motif est faux (règle axe `aria-required-parent`). Quand ce sont des
//    sections, une navigation avec `aria-current` ; quand c'est un choix
//    d'affichage, `aria-pressed`.
// 2. L'animation `spin` redéfinie à la main : sept `<style>` identiques dans
//    l'admin, et un `animation: 'spin …'` qui ne tient que si Tailwind émet
//    ses keyframes ailleurs. La classe `animate-spin` dit la même chose, une fois.

const RACINE = resolve(__dirname, '../../..')
const SRC = join(RACINE, 'src')

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return nom === 'test' ? [] : fichiers(chemin)
    return /\.(jsx?|tsx?)$/.test(nom) ? [chemin] : []
  })
}
const SOURCES = fichiers(SRC).map((f) => ({ f: relative(RACINE, f).replace(/\\/g, '/'), s: readFileSync(f, 'utf8') }))

describe('onglets', () => {
  it('aucun `role="tab"` sans sa liste d’onglets dans le même fichier', () => {
    const orphelins = SOURCES.filter(({ s }) => /role=["']tab["']/.test(s) && !/role=["']tablist["']/.test(s)).map(({ f }) => f)
    expect(orphelins).toEqual([])
  })
})

describe('animation de rotation', () => {
  it('personne ne redéfinit `@keyframes spin` ni n’écrit `animation: spin` à la main', () => {
    const fautes = SOURCES
      .filter(({ s }) => /@keyframes\s+spin\b/.test(s) || /animation:\s*[^,;\n]*['"`]spin\s/.test(s))
      .map(({ f }) => f)
    expect(fautes).toEqual([])
  })

  it('le témoin : le garde-fou voit bien les deux formes', () => {
    expect(/@keyframes\s+spin\b/.test('<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>')).toBe(true)
    expect(/animation:\s*[^,;\n]*['"`]spin\s/.test("style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}")).toBe(true)
    expect(/animation:\s*[^,;\n]*['"`]spin\s/.test("animation: 'fadeIn 0.2s ease'")).toBe(false)
  })
})
