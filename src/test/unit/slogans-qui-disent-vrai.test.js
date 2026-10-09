import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TAGLINES } from '@shared/static/taglines'

// Audit du 2026-10-04, UX-10. Le slogan de l'en-tête, vu par tous, promettait
// « Planifie tes repas » (aucune planification dans l'app) et « La liste de
// courses qui se fait toute seule » (le panier est « Bientôt » pour qui n'a
// pas le Premium). Et le tableau existait en deux copies identiques (en-tête,
// fenêtre Premium) : on en corrige une, l'autre ment encore.

describe('les slogans ne promettent que ce qui existe', () => {
  it('ni planification de repas, ni liste de courses, en fr comme en en', () => {
    for (const lang of ['fr', 'en']) {
      const faux = TAGLINES[lang].filter((s) => /planifi|plan your meals|liste de courses|shopping list/i.test(s))
      expect(faux, lang).toEqual([])
    }
    expect(TAGLINES.fr).toHaveLength(TAGLINES.en.length)
  })

  it('une seule liste : l’en-tête et la fenêtre Premium la lisent au même endroit', () => {
    for (const f of ['src/app/layout/header/HeaderLogo.jsx', 'src/features/premium/components/upgrade-modal.jsx']) {
      const source = readFileSync(resolve(process.cwd(), f), 'utf8')
      expect(source, f).not.toMatch(/const TAGLINES\s*=/)
      expect(source, f).toContain("from '@shared/static/taglines'")
    }
  })
})
