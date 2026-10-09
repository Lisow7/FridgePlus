#!/usr/bin/env node
// Plafond du poids de DÉMARRAGE, calqué sur le cliquet du lint
// (`scripts/verifier-plafond-lint.mjs`) — audit du 2026-10-04, PERF-18.
//
// Ce que chaque visiteur télécharge et analyse avant le premier affichage : le
// script d'entrée de `dist/index.html` et tout ce qu'il précharge
// (`modulepreload`). L'audit l'a mesuré à 415 Ko compressés, dont ≈ 120 Ko
// n'avaient rien à y faire : le journal des versions complet pour afficher
// « v0.145 », les textes légaux pour un lien, les dépendances des graphiques
// de l'admin. Rien ne protégeait ce poids : une ligne d'import suffit à y
// ramener une bibliothèque entière, sans qu'aucun test ne bronche.
//
// Deux règles, comme pour le lint :
//   1. au-dessus du plafond → échec. Ajouter du poids au démarrage se DÉCIDE :
//      on relève `poidsDemarrageGzipKoPlafond` dans package.json, dans la PR,
//      et on dit pourquoi ;
//   2. plus de JEU_KO sous le plafond → échec aussi, avec la valeur à écrire.
//      Un plafond qui surestime offre sa marge en silence.
// Contrairement au lint, un petit jeu est nécessaire : le moindre changement
// de code bouge les octets, et le build de la CI embarque ses propres clés.
// Le plafond s'écrit donc en Ko ENTIERS : la mesure arrondie au Ko supérieur.
//
// Taille mesurée en gzip niveau 9 (déterministe : même zlib, même Node, en
// local comme en CI). À lancer après `npm run build` — la CI le fait dans le
// job « Production build ».

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const JEU_KO = 4

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(racine, 'dist')
const pkg = JSON.parse(readFileSync(resolve(racine, 'package.json'), 'utf8'))

const PLAFOND = pkg.poidsDemarrageGzipKoPlafond
if (typeof PLAFOND !== 'number') {
  console.error('✖ `poidsDemarrageGzipKoPlafond` absent ou non numérique dans package.json.')
  process.exit(2)
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error('✖ dist/index.html introuvable : lancer `npm run build` avant ce script.')
  process.exit(2)
}

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const urls = new Set()
for (const m of html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g)) urls.add(m[1])
for (const m of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)) urls.add(m[1])
if (urls.size === 0) {
  console.error('✖ Aucun script de démarrage trouvé dans dist/index.html : le format du build a changé ?')
  process.exit(2)
}

// Les adresses du HTML portent la base du site (`/FridgePlus/` ou `/`).
function fichierDe(url) {
  const chemin = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/(FridgePlus\/)?/, '')
  return join(dist, chemin)
}

const fichiers = [...urls].map((url) => {
  const octets = readFileSync(fichierDe(url))
  return { url, gzip: gzipSync(octets, { level: 9 }).length }
}).sort((a, b) => b.gzip - a.gzip)

const ko = (o) => Math.round((o / 1024) * 10) / 10
const total = ko(fichiers.reduce((s, f) => s + f.gzip, 0))
const top = fichiers.slice(0, 5).map((f) => `    ${String(ko(f.gzip)).padStart(6)} Ko  ${f.url.split('/').pop()}`).join('\n')

if (total > PLAFOND) {
  console.error(`✖ Démarrage : ${total} Ko compressés pour un plafond de ${PLAFOND} Ko (${fichiers.length} fichiers).`)
  console.error('  Ce que chaque visiteur charge avant le premier affichage a grossi. Si c\'est voulu,')
  console.error('  relevez "poidsDemarrageGzipKoPlafond" dans package.json et dites pourquoi dans la PR.')
  console.error('  Les plus gros fichiers :\n' + top)
  process.exit(1)
}

if (PLAFOND - total > JEU_KO) {
  console.error(`✖ Plafond périmé : ${total} Ko réels pour un plafond de ${PLAFOND} Ko.`)
  console.error(`  Ce jeu de ${ko((PLAFOND - total) * 1024)} Ko laisse revenir autant de poids en silence.`)
  console.error(`  → Écrivez "poidsDemarrageGzipKoPlafond": ${Math.ceil(total)} dans package.json.`)
  process.exit(1)
}

console.log(`✓ Démarrage : ${total} Ko compressés (${fichiers.length} fichiers), plafond ${PLAFOND} Ko.`)
console.log('  Les plus gros fichiers :\n' + top)
