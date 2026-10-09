import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Un seul repère `main` par page (audit du 2026-10-04, A11Y-14). `app-shell`
// fournit `<main id="contenu-principal">` ; une page rendue DANS le shell qui
// ouvre son propre `<main>` en crée un second, imbriqué : un lecteur d'écran
// trouve deux « contenu principal », et axe relève trois règles d'un coup. La
// faute est déjà revenue une fois (`auth-layout.jsx` le raconte).
//
// Seuls ont droit à un `<main>` le shell lui-même et les écrans qui se rendent
// À SA PLACE (portes montées au-dessus de l'application, dans `main.jsx`).
const AUTORISES = new Set([
  'src/app/layout/app-shell.jsx',
  'src/features/auth/components/ecran-du-compte.jsx',
  'src/features/auth/components/verification-en-deux-etapes.jsx',
])

function fichiersJsx(dossier, liste = []) {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name)
    if (e.isDirectory()) { if (e.name !== 'test') fichiersJsx(p, liste) }
    else if (e.name.endsWith('.jsx')) liste.push(p)
  }
  return liste
}

describe('un seul repère main', () => {
  it('seuls le shell et les écrans qui le remplacent ouvrent un <main>', () => {
    const avecMain = fichiersJsx(join(process.cwd(), 'src'))
      .filter((f) => /<main[\s>]/.test(readFileSync(f, 'utf8').replace(/\/\/.*$|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\//gm, '')))
      .map((f) => relative(process.cwd(), f).split(sep).join('/'))
    expect(avecMain.filter((f) => !AUTORISES.has(f)), 'un <main> dans une page rendue sous le shell — utiliser <div> ou <section>').toEqual([])
  })
})
