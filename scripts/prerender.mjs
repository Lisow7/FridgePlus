/**
 * Écrit un HTML par recette dans `dist/recipe/<id>/index.html`, à partir du
 * `dist/index.html` fraîchement construit et du manifeste versionné.
 *
 * Lancé automatiquement par `npm run build` (après `vite build`).
 * N'ouvre AUCUNE connexion réseau : il tourne donc en CI, où les clés Supabase
 * sont vides. Cf. l'en-tête de `generate-prerender-manifest.mjs` pour le
 * pourquoi de cette séparation en deux temps.
 *
 * Ce fichier ne fait que des ENTRÉES/SORTIES : la construction du HTML vit dans
 * `scripts/lib/prerender-page.mjs`, pour que les tests appellent la vraie
 * fonction au lieu de relire ce source.
 *
 * ── Pourquoi `<id>/index.html` et JAMAIS `<id>.html` ──────────────────────
 * Mesuré en preview le 2026-08-15 (sonde jetable, PR #1012), sur notre
 * `vercel.json` dont le catch-all réécrit tout vers `/index.html` :
 *
 *   /recipe/x  ←  recipe/x.html        → 🔴 coquille SPA : le catch-all gagne
 *   /recipe/x  ←  recipe/x/index.html  → ✅ le fichier : résolu AVANT le rewrite
 *   /recipe/x  ←  (aucun fichier)      → ✅ coquille SPA : le fallback est intact
 *
 * Le premier cas est un échec SILENCIEUX : le fichier est bien déployé et
 * accessible via son URL avec `.html`, mais n'est jamais servi sur l'URL propre.
 * D'où la forme répertoire, et le test qui la verrouille.
 *
 * Conséquence heureuse : `vercel.json` n'a pas à bouger (la CSP ne bouge donc
 * pas non plus), et toute URL non pré-rendue — une future recette communauté —
 * retombe sur la SPA comme aujourd'hui.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  construirePage, construirePageStatique, corpsRecette, jsonLdRecette, temoinsManquants, idValide, PAGES_STATIQUES,
} from './lib/prerender-page.mjs'
import { CORPS_PAR_CHEMIN } from '../dist-ssr/corps-statique.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(root, 'dist')
const SOURCE = join(DIST, 'index.html')
const MANIFESTE = join(root, 'scripts', 'data', 'prerender-manifest.json')

if (!existsSync(SOURCE)) {
  console.error(`❌  ${SOURCE} introuvable — lancer \`vite build\` avant le pré-rendu.`)
  process.exit(1)
}
if (!existsSync(MANIFESTE)) {
  console.error('❌  scripts/data/prerender-manifest.json introuvable — lancer `npm run prerender:data`.')
  process.exit(1)
}

const gabarit = readFileSync(SOURCE, 'utf-8')
const { recettes, lang } = JSON.parse(readFileSync(MANIFESTE, 'utf-8'))

if (!Array.isArray(recettes) || recettes.length === 0) {
  console.error('❌  Manifeste vide — rien à pré-rendre. Relancer `npm run prerender:data`.')
  process.exit(1)
}

// Échec BRUYANT si le gabarit a changé de forme : mieux vaut casser le build
// que livrer 515 pages aux métadonnées génériques en croyant l'avoir corrigé.
const manquants = temoinsManquants(gabarit)
if (manquants.length > 0) {
  console.error("❌  dist/index.html n'a pas la forme attendue — balises introuvables :")
  manquants.forEach(re => console.error(`      ${re}`))
  console.error('    Le pré-rendu produirait des pages génériques. Corriger scripts/lib/prerender-page.mjs.')
  process.exit(1)
}

// Le conteneur que React monte. Sa forme exacte est vérifiée avant écriture :
// s'il changeait dans `index.html`, l'injection deviendrait silencieusement
// sans effet — le défaut qu'on corrige, mais en croyant l'avoir corrigé.
const RACINE_VIDE = '<div id="root"></div>'

let ecrites = 0
let corpsRecettesInjectes = 0
let balisagesRecette = 0
const ignorees = []

for (const recette of recettes) {
  if (!idValide(recette.id)) {
    ignorees.push(`${recette.id} (identifiant non conforme)`)
    continue
  }
  let html
  try {
    html = construirePage(gabarit, recette)
  } catch (err) {
    console.error(`❌  ${recette.id} : ${err.message} — pré-rendu interrompu.`)
    process.exit(1)
  }
  // Le CORPS, comme pour les pages statiques : sans lui, ces 515 fichiers
  // portaient un titre juste et pas une ligne de contenu.
  const corps = corpsRecette(recette)
  if (html.includes(RACINE_VIDE)) {
    html = html.replace(RACINE_VIDE, `<div id="root">${corps}</div>`)
    corpsRecettesInjectes++
  }

  // Le balisage `Recipe`, dans le HTML servi et plus seulement au montage.
  // `null` quand la recette n'a pas de photo : Google exige `image` pour ce
  // résultat enrichi, et un balisage inéligible sur 411 pages ne ferait que
  // du bruit dans la Search Console.
  const balisage = jsonLdRecette(recette)
  if (balisage) {
    html = html.replace(
      '</head>',
      `  <script type="application/ld+json" id="recipe-jsonld">${JSON.stringify(balisage)}</scr` + `ipt>\n  </head>`,
    )
    balisagesRecette++
  }

  const dossier = join(DIST, 'recipe', recette.id)
  mkdirSync(dossier, { recursive: true })
  writeFileSync(join(dossier, 'index.html'), html, 'utf-8')
  ecrites++
}

if (ignorees.length > 0) {
  console.warn(`⚠️   ${ignorees.length} recette(s) ignorée(s) : ${ignorees.slice(0, 5).join(', ')}${ignorees.length > 5 ? '…' : ''}`)
}
console.log(`✅  Pré-rendu : ${ecrites} pages recette écrites dans dist/recipe/<id>/index.html (langue : ${lang}).`)
console.log(`✅  Corps servi dans le HTML pour ${corpsRecettesInjectes} page(s) recette.`)
console.log(`✅  Balisage Recipe servi pour ${balisagesRecette} page(s) — les autres sont encore sans photo.`)

// ── Pages statiques ────────────────────────────────────────────────────────
// Mesuré en production le 2026-08-16 : `/legal`, `/changelog` et `/community`
// servaient TOUTES le titre générique de l'accueil dans leur HTML. Trois URL
// indexables se présentant comme la même page — et deux de plus depuis.
//
// Même forme répertoire que les recettes (`<chemin>/index.html`) : `faq.html`
// perdrait contre le catch-all de `vercel.json`, en silence.
let statiquesEcrites = 0
let corpsInjectes = 0


// Le pré-rendu ne produit QU'UNE langue, la même que les recettes.
const LANGUE_PRERENDU = 'fr'
for (const page of PAGES_STATIQUES) {
  let html
  try {
    html = construirePageStatique(gabarit, page)
  } catch (err) {
    console.error(`❌  ${page.chemin} : ${err.message} — pré-rendu interrompu.`)
    process.exit(1)
  }
  // ── Le CORPS, et pas seulement les métadonnées ─────────────────────────
  // Mesuré le 2026-08-19 : le fichier servi portait le bon titre et pas une
  // ligne de contenu. Googlebot exécute le JS et voyait tout ; GPTBot,
  // ClaudeBot et PerplexityBot ne l'exécutent pas et ne voyaient rien.
  //
  // Le corps est injecté DANS `#root`. React le remplace au montage : le
  // point d'entrée appelle `createRoot()`, pas `hydrateRoot()`, donc aucune
  // correspondance n'est exigée et il n'y a pas de faute d'hydratation
  // possible. Un conteneur frère aurait demandé de le retirer à la main, et
  // un script en ligne se ferait refuser par la CSP.
  const generateur = CORPS_PAR_CHEMIN[page.chemin]
  if (generateur) {
    const corps = generateur.corps(LANGUE_PRERENDU)
    if (!corps || corps.length < 200) {
      console.error(`❌  ${page.chemin} : corps vide ou suspect (${corps?.length ?? 0} car.) — pré-rendu interrompu.`)
      process.exit(1)
    }
    if (!html.includes(RACINE_VIDE)) {
      console.error(`❌  ${page.chemin} : ${RACINE_VIDE} introuvable dans le gabarit — le corps ne serait allé nulle part.`)
      process.exit(1)
    }
    html = html.replace(RACINE_VIDE, `<div id="root">${corps}</div>`)

    const donnees = generateur.jsonLd?.(LANGUE_PRERENDU)
    if (donnees) {
      html = html.replace('</head>', `  <script type="application/ld+json" id="${generateur.jsonLdId ?? ''}">${JSON.stringify(donnees)}</scr` + `ipt>
  </head>`)
    }
    corpsInjectes++
  }

  const dossier = join(DIST, ...page.chemin.replace(/^\//, '').split('/'))
  mkdirSync(dossier, { recursive: true })
  writeFileSync(join(dossier, 'index.html'), html, 'utf-8')
  statiquesEcrites++
}
console.log(`✅  Pré-rendu : ${statiquesEcrites} pages statiques écrites (${PAGES_STATIQUES.map(p => p.chemin).join(', ')}).`)
console.log(`✅  Corps servi dans le HTML pour ${corpsInjectes} page(s) : ${Object.keys(CORPS_PAR_CHEMIN).join(', ')}.`)
