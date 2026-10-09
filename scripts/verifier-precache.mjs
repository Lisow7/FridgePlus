#!/usr/bin/env node
// Garde-fou du PRÉCACHE du service worker — audit du 2026-10-04, SEO-11.
// Calqué sur le plafond du poids de démarrage (`verifier-poids-demarrage.mjs`).
//
// Ce que chaque nouveau visiteur télécharge en arrière-plan dès sa première
// visite : toutes les entrées de `precacheAndRoute([...])` dans `dist/sw.js`.
// L'audit y a trouvé près de 300 Ko que l'application n'affiche jamais :
//   - les images de partage `og-*`, lues par les robots des réseaux sociaux ;
//   - `404.html`, servie par Vercel pour un FICHIER introuvable, jamais par
//     l'application ;
//   - les icônes de notification, que le navigateur va chercher à l'arrivée
//     d'une notification — réseau présent par définition ;
//   - `icons.svg`, sprite resté du gabarit Vite du premier commit.
// Il suffit d'une ligne de `vite.config.js` (`includeAssets`, un motif `png`
// pris en bloc) pour les y remettre, sans qu'aucun test ne bronche.
//
// Deux contrôles :
//   1. aucune entrée ne correspond à un motif EXCLU — y compris les exclusions
//      plus anciennes (Sentry, panneau admin, graphiques, captures, emoji) :
//      ce qui a été sorti exprès ne revient pas en silence ;
//   2. le poids total reste sous `precacheGzipKoPlafond`, avec la règle du
//      cliquet de démarrage : au-dessus → échec, et ajouter du poids au
//      précache se DÉCIDE (on relève le plafond dans la PR, en disant
//      pourquoi) ; plus de JEU_KO dessous → échec aussi, avec la valeur à
//      écrire. Un plafond qui surestime offre sa marge en silence.
//
// Taille en gzip niveau 9 (déterministe), comme le poids de démarrage : c'est
// ce qui transite, à peu près — Vercel compresse le texte, pas les images.
// À lancer après `npm run build` — la CI le fait dans le job « Production build ».

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const JEU_KO = 16

// Une entrée du précache ne doit JAMAIS correspondre à l'un de ces motifs.
export const EXCLUS = [
  { motif: /(^|\/)og-[^/]+$/, raison: 'image de partage : lue par les robots des réseaux, jamais affichée' },
  { motif: /(^|\/)404\.html$/, raison: 'page 404 de Vercel : jamais servie par l’application' },
  { motif: /(^|\/)icons\/push-icon-/, raison: 'icône de notification : chargée à l’arrivée d’une notification' },
  { motif: /(^|\/)icons\.svg$/, raison: 'sprite du gabarit Vite, utilisé nulle part' },
  { motif: /(^|\/)(apple-touch-icon\.png|favicon\.ico)$/, raison: 'icône demandée par le système ou le navigateur, en ligne (l’application a favicon.svg)' },
  { motif: /(^|\/)screenshots\//, raison: 'captures du manifeste : stores et invite d’installation' },
  { motif: /(^|\/)emoji\//, raison: 'emoji hébergés : mis en cache à la demande' },
  { motif: /(^|\/)fridge-logo-[^/]+\.webp$/, raison: 'logo de la bienvenue : affiché au premier passage, en ligne' },
  { motif: /(^|\/)vendor-sentry-[^/]+\.js$/, raison: 'Sentry : chargé seulement après consentement' },
  { motif: /(^|\/)admin-panel-[^/]+\.js$/, raison: 'panneau admin : réservé aux admins' },
  { motif: /(^|\/)vendor-recharts-[^/]+\.js$/, raison: 'graphiques : à la demande' },
]

/** Les adresses du précache, dans l'ordre, sans doublon. */
export function entreesDuPrecache(sw) {
  const appel = sw.indexOf('precacheAndRoute(')
  if (appel < 0) return null
  const urls = [...sw.slice(appel).matchAll(/\{url:"([^"]+)",revision:(?:"[^"]*"|null)\}/g)].map((m) => m[1])
  return [...new Set(urls)]
}

/** Les entrées qui correspondent à un motif exclu, avec la raison. */
export function entreesExclues(urls) {
  return urls.flatMap((url) => {
    const regle = EXCLUS.find(({ motif }) => motif.test(url))
    return regle ? [{ url, raison: regle.raison }] : []
  })
}

function principal() {
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dist = resolve(racine, 'dist')
  const pkg = JSON.parse(readFileSync(resolve(racine, 'package.json'), 'utf8'))

  const PLAFOND = pkg.precacheGzipKoPlafond
  if (typeof PLAFOND !== 'number') {
    console.error('✖ `precacheGzipKoPlafond` absent ou non numérique dans package.json.')
    process.exit(2)
  }
  if (!existsSync(join(dist, 'sw.js'))) {
    console.error('✖ dist/sw.js introuvable : lancer `npm run build` avant ce script.')
    process.exit(2)
  }

  const urls = entreesDuPrecache(readFileSync(join(dist, 'sw.js'), 'utf8'))
  if (!urls?.length) {
    console.error('✖ Aucune entrée de précache trouvée dans dist/sw.js : le format du build a changé ?')
    process.exit(2)
  }

  const exclues = entreesExclues(urls)
  if (exclues.length > 0) {
    console.error(`✖ ${exclues.length} fichier(s) exclu(s) exprès sont revenus dans le précache :`)
    for (const { url, raison } of exclues) console.error(`    ${url} — ${raison}`)
    console.error('  Chaque nouveau visiteur les téléchargerait en arrière-plan. Voir `globIgnores`')
    console.error('  et `includeAssets` dans vite.config.js.')
    process.exit(1)
  }

  const fichiers = urls.map((url) => {
    const chemin = join(dist, url.replace(/^\/(FridgePlus\/)?/, ''))
    if (!existsSync(chemin)) {
      console.error(`✖ ${url} est au précache mais absent de dist/.`)
      process.exit(2)
    }
    return { url, gzip: gzipSync(readFileSync(chemin), { level: 9 }).length }
  }).sort((a, b) => b.gzip - a.gzip)

  const ko = (o) => Math.round((o / 1024) * 10) / 10
  const total = ko(fichiers.reduce((s, f) => s + f.gzip, 0))
  const top = fichiers.slice(0, 5).map((f) => `    ${String(ko(f.gzip)).padStart(6)} Ko  ${f.url}`).join('\n')

  if (total > PLAFOND) {
    console.error(`✖ Précache : ${total} Ko compressés pour un plafond de ${PLAFOND} Ko (${fichiers.length} fichiers).`)
    console.error('  Ce que chaque nouveau visiteur télécharge en arrière-plan a grossi. Si c\'est voulu,')
    console.error('  relevez "precacheGzipKoPlafond" dans package.json et dites pourquoi dans la PR.')
    console.error('  Les plus gros fichiers :\n' + top)
    process.exit(1)
  }

  if (PLAFOND - total > JEU_KO) {
    console.error(`✖ Plafond périmé : ${total} Ko réels pour un plafond de ${PLAFOND} Ko.`)
    console.error(`  Ce jeu de ${ko((PLAFOND - total) * 1024)} Ko laisse revenir autant de poids en silence.`)
    console.error(`  → Écrivez "precacheGzipKoPlafond": ${Math.ceil(total)} dans package.json.`)
    process.exit(1)
  }

  console.log(`✓ Précache : ${total} Ko compressés (${fichiers.length} fichiers), plafond ${PLAFOND} Ko, aucun fichier exclu.`)
  console.log('  Les plus gros fichiers :\n' + top)
}

// Importable par les tests sans s'exécuter.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal()
