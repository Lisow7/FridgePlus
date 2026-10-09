import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Retour d'Antoine du 2026-10-04 : tout ce qui se touche pour s'ouvrir le
// montre — chaque poignée de porte fermée et de placard luit (`.fp-poignee`,
// cf. src/index.css). L'e2e `porte-qui-invite` ne voit que le frigo par
// défaut ; ce relevé couvre les trois formes de frigo et le garde-manger :
// une poignée ajoutée sans la classe, ou une classe perdue, casse ici.
const POIGNEES = {
  'src/features/fridge/components/fridge-standard.jsx': 1,
  'src/features/fridge/components/fridge-side-by-side.jsx': 2,
  'src/features/fridge/components/fridge-multi-door.jsx': 2,
  'src/features/fridge/components/pantry-shelf.jsx': 1,
}
// Le dégradé orange des poignées de porte (le garde-manger a la sienne, teintée)
const DEGRADE_POIGNEE = 'linear-gradient(180deg, #F5A45A 0%, #E07820 100%)'

describe('poignées qui luisent', () => {
  for (const [fichier, n] of Object.entries(POIGNEES)) {
    it(`${fichier.split('/').pop()} : ${n} poignée(s), toutes avec .fp-poignee`, () => {
      const src = readFileSync(resolve(process.cwd(), fichier), 'utf8')
      expect(src.match(/className="fp-poignee[\s"]/g)?.length ?? 0).toBe(n)
      if (!fichier.includes('pantry')) expect(src.split(DEGRADE_POIGNEE).length - 1).toBe(n)
    })
  }

  // Depuis l'audit du 2026-10-04 (PERF-09), la lueur vit dans un
  // pseudo-élément dont seule l'opacité s'anime (voir animations-composees.test.js).
  it('le halo est défini, et reste fixe en mouvement réduit', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(/\.fp-poignee::after\s*\{[^}]*animation:\s*fp-luit 2\.4s/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.fp-poignee::after,\s*\.fp-luit-bouton::after\s*\{\s*animation:\s*none;\s*opacity:\s*1/)
  })

  it("le bouton orange de l'en-tête luit aussi, menu fermé seulement", () => {
    const src = readFileSync(resolve(process.cwd(), 'src/features/fridge/components/fridge-fab.jsx'), 'utf8')
    expect(src).toContain("className={open ? undefined : 'fp-luit-bouton'}")
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(/\.fp-luit-bouton::after\s*\{[^}]*animation:\s*fp-luit-bouton 2\.4s/)
  })
})
