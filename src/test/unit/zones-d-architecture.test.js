import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Audit du 2026-10-04, ARCH-13 (1, 2, 3) — les zones d'ESLint avaient des trous :
// la liste FEATURES ne couvrait que 15 des 18 dossiers de src/features (une
// feature absente de la liste n'est protégée de rien), et src/routes/ n'était
// dans aucune zone — shared/ et features/ en dépendaient (titre de route,
// squelette de page), à rebours du flux shared → features → routes → app.

const RACINE = resolve(process.cwd())
const config = readFileSync(join(RACINE, 'eslint.config.js'), 'utf8')

function fichiers(dossier) {
  const out = []
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) out.push(...fichiers(chemin))
    else if (/\.jsx?$/.test(e.name)) out.push(chemin)
  }
  return out
}

describe('zones d’architecture', () => {
  it('la liste FEATURES d’ESLint couvre chaque dossier de src/features', () => {
    const bloc = config.slice(config.indexOf('const FEATURES = ['), config.indexOf(']', config.indexOf('const FEATURES = [')))
    const listees = [...bloc.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort()
    const dossiers = readdirSync(join(RACINE, 'src/features'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort()
    expect(listees).toEqual(dossiers)
  })

  it('ni shared/ ni features/ n’importent routes/', () => {
    const coupables = []
    for (const dossier of ['src/shared', 'src/features']) {
      for (const f of fichiers(join(RACINE, dossier))) {
        const code = readFileSync(f, 'utf8')
        if (/from\s+'(@routes\/|(\.\.\/)+routes\/)/.test(code)) coupables.push(f.slice(RACINE.length + 1).replaceAll('\\', '/'))
      }
    }
    expect(coupables).toEqual([])
    // Et ESLint le garde pour la suite : routes/ est une zone interdite à shared/ et features/.
    expect(config).toMatch(/from:\s*'\.\/src\/routes'/)
  })
})
