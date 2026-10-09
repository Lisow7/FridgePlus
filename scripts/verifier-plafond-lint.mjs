#!/usr/bin/env node
// Lint + cliquet SANS JEU sur le nombre d'avertissements.
//
// POURQUOI CE SCRIPT — `--max-warnings N` seul ne protège que d'un côté. Le
// dépôt s'est déjà fait prendre : le 2026-08-09, le plafond portait 101 pour
// 100 avertissements réels, et ce cran de jeu a laissé passer une PR qui en
// ajoutait un — prouvé par mutation à l'époque, `eslint` sortait exit 0.
// Le plafond a été resserré à 100… puis le dépôt est redescendu à 98 sans que
// personne ne rabaisse le plafond. Deux crans de jeu, le même défaut, deux
// releases plus tard.
//
// C'est exactement la règle (4) du cliquet de taille des composants
// (`src/test/unit/component-size-budget.test.js`) : « que la dette SURESTIME »
// est un défaut au même titre qu'un dépassement. Un plafond qui surestime la
// dette offre en silence la marge exacte de son écart.
//
// Ce script rend la règle exécutable pour le lint : il échoue AUSSI quand le
// compte est SOUS le plafond, en disant quelle valeur écrire. Le cliquet
// s'entretient donc au moment même où le travail de réduction est fait, au
// lieu de dépendre de la vigilance de quelqu'un.
//
// Il n'y a volontairement AUCUNE tolérance : le plafond vaut le compte exact.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Binaire ESLint appelé par `node` directement : passer par `npx` imposerait un
// shell sous Windows, ce qui déclenche DEP0190 (arguments concaténés, non
// échappés) — un shell n'a rien à faire dans un garde-fou de CI.
const ESLINT_BIN = resolve(racine, 'node_modules', 'eslint', 'bin', 'eslint.js')
const pkg = JSON.parse(readFileSync(resolve(racine, 'package.json'), 'utf8'))

// Le plafond vit dans package.json pour rester lisible d'un coup d'œil et
// modifiable sans toucher au code du script.
const PLAFOND = pkg.lintWarningsPlafond
if (typeof PLAFOND !== 'number') {
  console.error('✖ `lintWarningsPlafond` absent ou non numérique dans package.json.')
  process.exit(2)
}

let sortie
try {
  sortie = execFileSync(process.execPath, [ESLINT_BIN, '.', '--format', 'json'], {
    cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
} catch (err) {
  // ESLint sort en code 1 dès qu'il y a une erreur — le JSON reste sur stdout.
  sortie = err.stdout
  if (!sortie) {
    console.error('✖ ESLint n\'a produit aucune sortie exploitable.')
    console.error(err.stderr ?? err.message)
    process.exit(2)
  }
}

const rapport = JSON.parse(sortie)
let erreurs = 0
let avertissements = 0
const parRegle = new Map()
for (const fichier of rapport) {
  for (const m of fichier.messages) {
    if (m.severity === 2) erreurs++
    else if (m.severity === 1) {
      avertissements++
      const regle = m.ruleId ?? '(sans règle)'
      parRegle.set(regle, (parRegle.get(regle) ?? 0) + 1)
    }
  }
}

if (erreurs > 0) {
  // Réaffiche la sortie lisible : le format JSON ne sert qu'au comptage.
  try {
    execFileSync(process.execPath, [ESLINT_BIN, '.'], { cwd: racine, stdio: 'inherit' })
  } catch { /* la sortie est déjà affichée */ }
  console.error(`\n✖ ${erreurs} erreur(s) de lint. Aucune n'est tolérée.`)
  process.exit(1)
}

const top = [...parRegle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
const detail = top.map(([r, n]) => `    ${String(n).padStart(3)}  ${r}`).join('\n')

if (avertissements > PLAFOND) {
  console.error(`✖ ${avertissements} avertissements pour un plafond de ${PLAFOND}.`)
  console.error('  Le plafond ne se MONTE jamais : corrigez les nouveaux avertissements.')
  console.error('  Répartition actuelle (5 premières règles) :\n' + detail)
  process.exit(1)
}

if (avertissements < PLAFOND) {
  console.error(`✖ Plafond périmé : ${avertissements} avertissements réels pour un plafond de ${PLAFOND}.`)
  console.error(`  Ce jeu de ${PLAFOND - avertissements} laisse passer autant de nouveaux avertissements en silence.`)
  console.error(`  → Écrivez "lintWarningsPlafond": ${avertissements} dans package.json.`)
  process.exit(1)
}

console.log(`✓ Lint : 0 erreur, ${avertissements} avertissements — plafond tenu au cran exact.`)
console.log('  Répartition (5 premières règles) :\n' + detail)
