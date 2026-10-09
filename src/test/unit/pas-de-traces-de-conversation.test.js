import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Le dépôt est public : il porte le code, pas les coulisses. Ce garde-fou refuse
// qu'un fichier versionné nomme l'outillage personnel de développement, ses
// notes de travail, ses « planches » de décision ou une adresse personnelle —
// les mots qu'un export propre a retirés le 2026-10-09, et qu'un commit
// ordinaire ramènerait sans que personne ne s'en aperçoive.
//
// ClaudeBot est admis : c'est le nom public d'un robot d'indexation, cité à
// côté de GPTBot et PerplexityBot dans les notes sur le pré-rendu.

const RACINE = process.cwd()
const DOSSIERS_IGNORES = new Set(['.git', 'node_modules', 'dist', 'dist-ssr', 'dev-dist', 'coverage', 'test-results', 'playwright-report', '.worktrees'])
const BINAIRE = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|mp3|mp4|wav|bin)$/i
const CE_FICHIER = 'src/test/unit/pas-de-traces-de-conversation.test.js'

const MOTIFS = [
  ['outillage personnel', /claude(?!bot)/i],
  ['outillage personnel', /anthropic/i],
  ['outillage personnel', /superpowers/i],
  ['planche de décision', /planche n/i],
  ['note de travail', /~\/\.claude/],
  ['note de travail', /\bCLAUDE\.md\b/],
  ['note de travail', /\bmemory\/[a-z_]+\.md/],
  ['agent nommé', /chef-recipe-editor|verif-image-correspondance/],
  ['dossier privé', /docs\/(superpowers|audits)\//],
  ['adresse personnelle', /lisow33@|antoinemazelaygue|passmail\.net/i],
]

function fichiers(d = RACINE, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) { if (!DOSSIERS_IGNORES.has(e.name)) fichiers(p, out) }
    else out.push(p)
  }
  return out
}

function traces() {
  const trouvees = []
  for (const p of fichiers()) {
    const chemin = relative(RACINE, p).split(sep).join('/')
    if (chemin === CE_FICHIER || BINAIRE.test(chemin) || statSync(p).size > 4_000_000) continue
    const contenu = readFileSync(p)
    if (contenu.subarray(0, 8192).includes(0)) continue
    const lignes = contenu.toString('utf8').split(/\r?\n/)
    lignes.forEach((ligne, i) => {
      for (const [quoi, motif] of MOTIFS) if (motif.test(ligne)) trouvees.push(`${chemin}:${i + 1} (${quoi}) ${ligne.trim().slice(0, 100)}`)
    })
  }
  return trouvees
}

describe('Dépôt public — aucune trace des coulisses', () => {
  // Deux mille fichiers lus d'un trait : plus que les 5 s par défaut sur une
  // machine chargée (les autres balayages de source ont le même défaut).
  it('aucun fichier versionné ne nomme l\'outillage, les notes de travail ou une adresse personnelle', () => {
    expect(traces()).toEqual([])
  }, 60_000)
})
