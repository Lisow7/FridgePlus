import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// L'API du panneau admin (`features/admin/api/*`, 600 lignes) n'est importée que
// par le panneau, chargé à la demande. Importée par du code de démarrage — le
// crochet des badges de l'en-tête l'était, pour une seule fonction —, Rollup la
// plaçait TOUT ENTIÈRE dans le morceau principal de chaque visiteur : chaque
// fonction ajoutée au panneau alourdissait le démarrage (2026-10-08 : 286,2 Ko,
// au-dessus du plafond ; 283,7 Ko une fois le crochet passé par le dépôt).

const RACINE = process.cwd()
const fichiers = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom)
  if (statSync(chemin).isDirectory()) return fichiers(chemin)
  return /[.]jsx?$/.test(nom) ? [chemin] : []
})

describe('l’API admin reste hors du démarrage', () => {
  it('aucun code hors du panneau admin n’importe son API', () => {
    const coupables = fichiers(resolve(RACINE, 'src'))
      .map((f) => relative(RACINE, f).split('\\').join('/'))
      .filter((f) => !f.startsWith('src/features/admin/') && !f.startsWith('src/test/'))
      .filter((f) => /from\s+['"]@features\/admin\/api\//.test(readFileSync(resolve(RACINE, f), 'utf8')))
    expect(coupables, 'Passer par le dépôt partagé (ex. recipes-repository) ou un petit module à part.').toEqual([])
  })
})
