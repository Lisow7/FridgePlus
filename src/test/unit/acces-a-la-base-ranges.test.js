import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Audit du 2026-10-04, ARCH-13 (6) — la base se lit et s'écrit dans les modules
// `api/` (et `lib/`), pas dans un composant, un hook ou une page. Quatre hooks
// et une section appelaient Supabase en direct ; l'un d'eux (« J'ai fait mes
// courses ») jetait le résultat de l'écriture au frigo, puis vidait le panier
// quand même : les achats disparaissaient des deux côtés.
//
// Ce garde-fou refuse qu'un composant, un hook ou une page importe le client.

const RACINE = resolve(process.cwd())
const CLIENT = /from\s+'@shared\/lib\/supabase\/client'/

// Les seules exceptions, chacune avec sa raison.
const EXCEPTIONS = {
  // La plomberie de l'authentification : lit la session de la bibliothèque à
  // l'arrivée d'un lien e-mail, pour le seul `AuthProvider` (comme lui).
  'src/shared/hooks/use-auth-link-problem.js': 'session à l’arrivée d’un lien e-mail',
}

function fichiers(dossier) {
  const out = []
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) { if (e.name !== 'test') out.push(...fichiers(chemin)) }
    else if (/\.jsx?$/.test(e.name)) out.push(chemin)
  }
  return out
}

describe('la base se touche dans les modules api/', () => {
  it('aucun composant, hook ou page n’importe le client Supabase (hors exceptions nommées)', () => {
    const coupables = fichiers(join(RACINE, 'src'))
      .map((f) => f.slice(RACINE.length + 1).replaceAll('\\', '/'))
      .filter((rel) => /\/(components|hooks|pages)\//.test(rel))
      .filter((rel) => CLIENT.test(readFileSync(join(RACINE, rel), 'utf8')))
      .filter((rel) => !EXCEPTIONS[rel])
    expect(coupables).toEqual([])
  })

  it('les exceptions existent encore (une exception sans objet se retire)', () => {
    for (const rel of Object.keys(EXCEPTIONS)) {
      expect(CLIENT.test(readFileSync(join(RACINE, rel), 'utf8')), rel).toBe(true)
    }
  })
})
