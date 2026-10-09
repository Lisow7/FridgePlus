import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Aucune recherche ILIKE ne glisse une saisie brute dans son motif (audit du
// 2026-10-04, ADM-10). Huit recherches le faisaient, chacune à sa façon —
// retirer `_` (pseudo introuvable), retirer la virgule (recherche changée),
// ou rien (une virgule cassait la requête, `_` devenait un joker). Toutes
// passent désormais par `@shared/lib/supabase/motif-de-recherche`.
//
// Repérés : `.ilike('col', \`…${x}…\`)` et, dans un `.or()`, `ilike.%${x}`.

const BRUT = [
  /\.ilike\(\s*['"][^'"]+['"]\s*,\s*`[^`]*\$\{/,
  /ilike\.%\$\{/,
]

function fichiers(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name)
    if (e.isDirectory()) return /^(test|node_modules)$/.test(e.name) ? [] : fichiers(p)
    return /\.jsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : []
  })
}

export const motifsBruts = (code) => code.split('\n')
  .map((ligne, i) => (BRUT.some((re) => re.test(ligne)) ? `${i + 1} : ${ligne.trim()}` : null))
  .filter(Boolean)

describe('recherches : la saisie passe par motif-de-recherche', () => {
  it('le témoin voit les deux formes brutes, et laisse passer les motifs protégés', () => {
    expect(motifsBruts("q.ilike('title', `%${search.trim()}%`)")).toHaveLength(1)
    expect(motifsBruts('q.or(`id.ilike.%${s}%,labels->>fr.ilike.%${s}%`)')).toHaveLength(1)
    expect(motifsBruts("q.ilike('title', motifContient(search))")).toEqual([])
    expect(motifsBruts('q.or(`id.ilike.${m},labels->>fr.ilike.${m}`)')).toEqual([])
  })

  it('aucune dans src/', () => {
    const racine = path.resolve(process.cwd(), 'src')
    const fautes = fichiers(racine).flatMap((f) => motifsBruts(fs.readFileSync(f, 'utf8'))
      .map((x) => `${path.relative(racine, f).split(path.sep).join('/')}:${x}`))
    expect(fautes).toEqual([])
  })
})
