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
//
// DEUX SORTES DE PLAFONDS (depuis le 2026-10-08) — `lintWarningsPlafond` pour
// les avertissements ordinaires, et `lintPlafondsParRegle` pour une règle
// comptée À PART, chacune au cran exact. La première : `max-lines-per-function`
// (audit du 2026-10-04, ARCH-08 — 158 fonctions de plus de 100 lignes dans
// src/). Mêlés au compte général, ses avertissements auraient noyé les autres ;
// à part, le plafond refuse qu'il naisse une fonction longue de plus, et se
// baisse à chaque fonction découpée. Un seul passage d'ESLint pour les deux.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Compte un rapport ESLint (format JSON). Les règles de `plafondsParRegle` sont
 * comptées à part (`separes`) et ne figurent ni dans `avertissements` ni dans
 * `parRegle` ; une règle à part sans avertissement compte 0.
 */
export function compterLeLint(rapport, plafondsParRegle = {}) {
  let erreurs = 0
  let avertissements = 0
  const parRegle = new Map()
  const separes = new Map(Object.keys(plafondsParRegle).map((regle) => [regle, 0]))
  for (const fichier of rapport) {
    for (const m of fichier.messages) {
      if (m.severity === 2) { erreurs++; continue }
      if (m.severity !== 1) continue
      const regle = m.ruleId ?? '(sans règle)'
      if (separes.has(regle)) { separes.set(regle, separes.get(regle) + 1); continue }
      avertissements++
      parRegle.set(regle, (parRegle.get(regle) ?? 0) + 1)
    }
  }
  return { erreurs, avertissements, parRegle, separes }
}

function principal() {
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  // Binaire ESLint appelé par `node` directement : passer par `npx` imposerait un
  // shell sous Windows, ce qui déclenche DEP0190 (arguments concaténés, non
  // échappés) — un shell n'a rien à faire dans un garde-fou de CI.
  const ESLINT_BIN = resolve(racine, 'node_modules', 'eslint', 'bin', 'eslint.js')
  const pkg = JSON.parse(readFileSync(resolve(racine, 'package.json'), 'utf8'))

  // Les plafonds vivent dans package.json pour rester lisibles d'un coup d'œil
  // et modifiables sans toucher au code du script.
  const PLAFOND = pkg.lintWarningsPlafond
  if (typeof PLAFOND !== 'number') {
    console.error('✖ `lintWarningsPlafond` absent ou non numérique dans package.json.')
    process.exit(2)
  }
  const PLAFONDS_PAR_REGLE = pkg.lintPlafondsParRegle ?? {}
  for (const [regle, plafond] of Object.entries(PLAFONDS_PAR_REGLE)) {
    if (typeof plafond !== 'number') {
      console.error(`✖ \`lintPlafondsParRegle["${regle}"]\` n'est pas un nombre dans package.json.`)
      process.exit(2)
    }
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

  const { erreurs, avertissements, parRegle, separes } = compterLeLint(JSON.parse(sortie), PLAFONDS_PAR_REGLE)

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

  for (const [regle, plafond] of Object.entries(PLAFONDS_PAR_REGLE)) {
    const compte = separes.get(regle)
    if (compte > plafond) {
      console.error(`✖ ${regle} : ${compte} avertissements pour un plafond de ${plafond}.`)
      console.error('  Ce plafond ne se MONTE pas non plus : découpez la nouvelle fonction.')
      process.exit(1)
    }
    if (compte < plafond) {
      console.error(`✖ Plafond périmé : ${regle} compte ${compte} pour un plafond de ${plafond}.`)
      console.error(`  → Écrivez "${regle}": ${compte} dans lintPlafondsParRegle (package.json).`)
      process.exit(1)
    }
  }

  console.log(`✓ Lint : 0 erreur, ${avertissements} avertissements — plafond tenu au cran exact.`)
  console.log('  Répartition (5 premières règles) :\n' + detail)
  for (const [regle, compte] of separes) console.log(`✓ ${regle} : ${compte}, au cran exact (plafond à part).`)
}

// Importable par les tests sans lancer ESLint.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal()
