import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Audit du 2026-10-04, ADM-30 : des `console.error` actifs en production dans
// le panneau admin et son API — ils n'arrivent jamais à Sentry, personne ne
// les lit. Une erreur se journalise par `logError` (Sentry, après
// consentement) ; `console.*` ne reste admis que sous `import.meta.env.DEV`,
// ou dans l'outil de plantage volontaire (`dev-crash-trigger.js`).

const RACINE = process.cwd()
const DOSSIERS = ['src/features/admin', 'src/features/support/api']
const ADMIS = new Set(['src/features/admin/lib/dev-crash-trigger.js'])

function fichiers(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) fichiers(p, out)
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

export function consolesEnProduction(texte) {
  const lignes = texte.split(/\r?\n/)
  const fautes = []
  lignes.forEach((ligne, i) => {
    if (!/\bconsole\.(log|error|warn|info|debug)\s*\(/.test(ligne)) return
    if (/^\s*(\/\/|\*)/.test(ligne)) return
    const contexte = lignes.slice(Math.max(0, i - 2), i + 1).join('\n')
    if (/import\.meta\.env\??\.DEV/.test(contexte)) return
    fautes.push(i + 1)
  })
  return fautes
}

describe('panneau admin — pas de console.* en production', () => {
  it('toute erreur passe par logError, console.* reste sous import.meta.env.DEV', () => {
    const fautes = []
    for (const d of DOSSIERS) {
      for (const p of fichiers(join(RACINE, d))) {
        const chemin = relative(RACINE, p).split(sep).join('/')
        if (ADMIS.has(chemin) || /\.test\./.test(chemin)) continue
        if (statSync(p).size === 0) continue
        for (const l of consolesEnProduction(readFileSync(p, 'utf8'))) fautes.push(`${chemin}:${l}`)
      }
    }
    expect(fautes).toEqual([])
  })

  it('le détecteur voit un console nu et laisse passer celui qui est sous DEV', () => {
    expect(consolesEnProduction("console.error('x')")).toEqual([1])
    expect(consolesEnProduction("if (import.meta.env.DEV) {\n  console.error('x')\n}")).toEqual([])
    expect(consolesEnProduction("if (error && import.meta.env?.DEV) console.error('x')")).toEqual([])
    expect(consolesEnProduction("// console.error('x')")).toEqual([])
  })
})
