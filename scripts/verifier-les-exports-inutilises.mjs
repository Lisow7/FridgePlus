#!/usr/bin/env node
// Cliquet du code mort vu par knip (audit du 2026-10-04, ARCH-14 (3)).
//
// knip sait compter les exports sans importeur, les fichiers que rien
// n'importe, les dépendances non déclarées… mais rien ne le lisait en CI : le
// compte montait sans qu'on le voie (75 exports à l'audit, 83 le 10/10). Même
// règle que `verifier-plafond-lint.mjs` : chaque catégorie est plafonnée AU
// CRAN EXACT dans package.json (`knipPlafonds`), le script échoue au-dessus
// ET au-dessous (plafond périmé : écrire la nouvelle valeur), et une catégorie
// absente de package.json vaut 0.
//
// Faux positifs réglés dans knip.json, pas ici : `public/push-handler.js` est
// un service worker (point d'entrée, jamais importé), et les fonctions edge
// importent par `npm:` (spécificateur Deno, pas une dépendance à déclarer).

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Catégories du rapport JSON de knip (reporter `json`) : chaque entrée de
// `issues` porte un tableau par catégorie, vide quand il n'y a rien à dire.
const CATEGORIES = [
  'files', 'exports', 'types', 'enumMembers', 'namespaceMembers', 'duplicates',
  'dependencies', 'devDependencies', 'optionalPeerDependencies', 'unlisted',
  'unresolved', 'binaries',
]

/** Compte, par catégorie, les trouvailles d'un rapport JSON de knip. */
export function compterKnip(rapport) {
  const comptes = {}
  for (const entree of rapport.issues ?? []) {
    for (const categorie of CATEGORIES) {
      const n = Array.isArray(entree[categorie]) ? entree[categorie].length : 0
      if (n) comptes[categorie] = (comptes[categorie] ?? 0) + n
    }
  }
  return comptes
}

/** Les écarts entre les comptes et les plafonds : vide quand tout est au cran exact. */
export function verdict(comptes, plafonds) {
  const ecarts = []
  const categories = new Set([...Object.keys(comptes), ...Object.keys(plafonds)])
  for (const categorie of [...categories].sort()) {
    const compte = comptes[categorie] ?? 0
    const plafond = plafonds[categorie] ?? 0
    if (compte > plafond) {
      ecarts.push(`✖ ${categorie} : ${compte} pour un plafond de ${plafond}. Retirer le code mort, ou justifier la hausse dans la PR.`)
    } else if (compte < plafond) {
      ecarts.push(`✖ Plafond périmé : ${categorie} compte ${compte} pour un plafond de ${plafond}. → Écrivez "${categorie}": ${compte} dans knipPlafonds (package.json).`)
    }
  }
  return ecarts
}

function principal() {
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const pkg = JSON.parse(readFileSync(resolve(racine, 'package.json'), 'utf8'))
  const plafonds = pkg.knipPlafonds
  if (!plafonds || typeof plafonds !== 'object') {
    console.error('✖ `knipPlafonds` absent de package.json.')
    process.exit(2)
  }
  // knip appelé par `node` directement (pas de shell : DEP0190 sous Windows).
  const bin = resolve(racine, 'node_modules', 'knip', 'bin', 'knip.js')
  const sortie = spawnSync(process.execPath, [bin, '--reporter', 'json', '--no-progress'], { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (!sortie.stdout) {
    console.error('✖ knip n\'a rien rendu.', sortie.stderr ?? '')
    process.exit(2)
  }
  let rapport
  try { rapport = JSON.parse(sortie.stdout) } catch {
    console.error('✖ Rapport knip illisible :', sortie.stdout.slice(0, 300))
    process.exit(2)
  }
  const comptes = compterKnip(rapport)
  const ecarts = verdict(comptes, plafonds)
  for (const [categorie, n] of Object.entries(comptes).sort()) console.log(`  ${String(n).padStart(4)}  ${categorie}`)
  if (ecarts.length) {
    for (const e of ecarts) console.error(e)
    process.exit(1)
  }
  console.log(`✓ knip : ${Object.keys(plafonds).map((c) => `${c} ${plafonds[c]}`).join(', ')} — au cran exact.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal()
