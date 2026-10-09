import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { containsProfanity } from '@shared/lib/moderation'

// Audit du 2026-10-04, CPT-10. Le dictionnaire français de leo-profanity n'est
// chargé que par le module partagé `src/shared/lib/moderation.js`, à son
// import. Cinq écrans importaient `leo-profanity` eux-mêmes : ils ne
// reconnaissaient le français que si moderation.js avait été chargé AVANT —
// un effet de bord d'ordre de chargement. « Choisis ton pseudo » (chargé à la
// demande au retour de Google), la bio, les publications, les réponses et les
// avis laissaient passer « connard ».

const RACINE = process.cwd()

function fichiers(dossier, acc = []) {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name)
    if (e.isDirectory()) { if (e.name !== 'test') fichiers(p, acc) }
    else if (/\.(js|jsx|mjs)$/.test(e.name)) acc.push(p)
  }
  return acc
}

describe('un seul filtre de grossièretés', () => {
  it('le module partagé reconnaît le français', () => {
    expect(containsProfanity('quel connard')).toBe(true)
    expect(containsProfanity('une recette de crêpes')).toBe(false)
  })

  it('aucun fichier de src/ n’importe leo-profanity, sauf le module partagé', () => {
    const importeurs = fichiers(join(RACINE, 'src'))
      .filter((f) => /from\s+['"]leo-profanity['"]|require\(\s*['"]leo-profanity['"]\s*\)/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(RACINE, f).split(sep).join('/'))
    expect(importeurs).toEqual(['src/shared/lib/moderation.js'])
  })
})
