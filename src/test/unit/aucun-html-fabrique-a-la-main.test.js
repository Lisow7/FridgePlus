import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// Cliquet : le code de l'app ne fabrique AUCUN document ou fragment HTML à
// partir de chaînes, et n'ouvre aucune fenêtre.
//
// POURQUOI (audit du 2026-10-04, SEC-01)
// Deux fiches d'impression (recette, liste de courses) étaient assemblées par
// concaténation puis ouvertes dans une fenêtre `blob:` de MÊME origine que
// l'app. L'échappement y était appliqué champ par champ : il suffisait d'en
// oublier un (`recipe.emoji`) pour qu'une donnée écrite par un inscrit devienne
// du code capable de lire la session de celui qui imprimait.
// React échappe tout ce qu'il rend. Ce cliquet garde cette propriété entière :
// le jour où une de ces API revient, c'est qu'un champ peut de nouveau être
// oublié.
//
// CE QU'IL NE VOIT PAS : les scripts de build (`scripts/`), qui écrivent du
// HTML par nature (pré-rendu) et ont leurs propres tests d'échappement.
const SRC = resolve(process.cwd(), 'src')

const INTERDITS = [
  ['window.open(', /\bwindow\.open\s*\(/],
  ['document.write', /\bdocument\.write(ln)?\s*\(/],
  ['innerHTML', /\.innerHTML\b/],
  ['outerHTML', /\.outerHTML\s*=/],
  ['insertAdjacentHTML', /\binsertAdjacentHTML\s*\(/],
  ['dangerouslySetInnerHTML', /\bdangerouslySetInnerHTML\b/],
  ['srcdoc', /\bsrcdoc\b/i],
  ['blob text/html', /text\/html/],
  ['balise <script> dans une chaîne', /<script\b/i],
  ['createContextualFragment', /\bcreateContextualFragment\s*\(/],
]

function fichiers(dossier) {
  return readdirSync(dossier).flatMap(nom => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return nom === 'test' ? [] : fichiers(chemin)
    return /\.(js|jsx|mjs)$/.test(nom) ? [chemin] : []
  })
}

// Les commentaires citent ces API pour expliquer ce qu'on a retiré : seul le
// CODE compte. Retrait volontairement simple (blocs puis lignes entières).
const sansCommentaires = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\s\/\/ .*$/gm, '')

describe('aucun HTML fabriqué à la main dans src/', () => {
  const sources = fichiers(SRC).map(chemin => ({
    chemin: relative(process.cwd(), chemin).replace(/\\/g, '/'),
    code: sansCommentaires(readFileSync(chemin, 'utf8')),
  }))

  it('parcourt bien le code de l’app', () => {
    expect(sources.length).toBeGreaterThan(400)
  })

  it.each(INTERDITS)('%s : aucun usage', (_nom, motif) => {
    const fautifs = sources.filter(s => motif.test(s.code)).map(s => s.chemin)
    expect(
      fautifs,
      'Rendre le contenu avec React (qui échappe) plutôt que par une chaîne HTML. ' +
      'Pour imprimer : `printReactElement` (src/shared/lib/print/print-element.js).',
    ).toEqual([])
  })
})
