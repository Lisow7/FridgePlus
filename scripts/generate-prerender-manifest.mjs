/**
 * Génère `scripts/data/prerender-manifest.json` — les métadonnées SEO des pages
 * recette, pour que `scripts/prerender.mjs` puisse écrire un HTML par recette
 * SANS toucher au réseau.
 *
 * Usage : `npm run prerender:data` — puis COMMITER le fichier produit.
 *
 * ── Pourquoi DEUX scripts et pas un seul ──────────────────────────────────
 * C'est la seule conception qui satisfait deux contraintes contradictoires :
 *
 *   1. Le HTML pré-rendu ne peut PAS être versionné. `dist/index.html`
 *      référence des assets HASHÉS (`/assets/index-BU7y-cAS.js`) et un base
 *      path VARIABLE (`/` sur Vercel, `/FridgePlus/` ailleurs — vite.config.js).
 *      Un fichier figé serait faux dès le build suivant : assets en 404 ⇒ page
 *      blanche sur les 515 recettes, sans qu'aucun test ne le signale (le
 *      fichier existe, il est servi — il est simplement mort).
 *      ⇒ le HTML DOIT être produit au build, depuis le `dist/index.html` frais.
 *
 *   2. Le build n'a pas accès à Supabase. La CI injecte des clés VIDES
 *      (cf. `scripts/generate-sitemap.mjs`), donc y brancher une requête ferait
 *      échouer la CI — ou pire, produirait silencieusement un pré-rendu vide.
 *
 * ⇒ Ce script-ci parle à Supabase et n'est lancé QU'À LA MAIN ; son résultat
 *   est versionné. `prerender.mjs` ne lit que ce fichier + `dist/index.html`,
 *   n'ouvre aucune connexion, et tourne donc partout.
 *
 * ── Contrepartie assumée : la fraîcheur ───────────────────────────────────
 * Le manifeste est figé jusqu'à la prochaine exécution — à relancer après un
 * ajout, un renommage ou une nouvelle photo de recette. Même contrepartie que
 * `npm run sitemap`, et le garde-fou est le même :
 * `src/test/unit/prerender-manifest-coherence.test.js`.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = join(root, 'scripts', 'data', 'prerender-manifest.json')

// La langue du pré-rendu. Une URL unique dessert les 5 langues (choix assumé,
// d'où l'absence de hreflang) : le HTML servi ne peut donc en porter qu'UNE.
// Le français, cohérent avec le scope de publication — la page elle-même
// s'affichera bien dans la langue du visiteur, c'est l'APERÇU PARTAGÉ qui est
// figé. Servir la bonne langue exigerait de lire `Accept-Language`, donc une
// exécution serveur : autre chantier (option B de la note interne sur le pré-rendu SEO).
const LANG = 'fr'

function loadEnv() {
  const envFile = join(root, '.env.local')
  if (!existsSync(envFile)) return {}
  const env = {}
  for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const SUPABASE_URL = env.VITE_SUPABASE_URL
// Clé PUBLIABLE et non service_role, comme le sitemap : on ne lit que ce qu'un
// visiteur anonyme voit déjà. Si la RLS masquait une recette, c'est précisément
// qu'elle ne doit pas être pré-rendue.
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Variables manquantes : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// Le filtre dit EXACTEMENT la même chose que `generate-sitemap.mjs` et que la
// propriété `url` du JSON-LD : ne pré-rendre que des pages que `useRecipeById`
// sait rendre. Pré-rendre une page « introuvable » serait le même défaut.
const { data, error } = await supabase
  .from('recipes_unified')
  .select('id, name, description, image_url, updated_at, time_min, prep_time_min, cook_time_min, servings, type, country')
  .is('deleted_at', null)
  .eq('status', 'published')
  .order('id')

if (error) {
  console.error('❌  Lecture Supabase échouée :', error.message)
  process.exit(1)
}

// Les pays, pour écrire `recipeCuisine` en toutes lettres — « Italienne », pas
// « IT ». Le code seul serait une donnée juste et un balisage inutile : Google
// attend un nom de cuisine lisible. En cas d'échec, on écrit simplement moins :
// le pré-rendu doit continuer sans cette table plutôt que s'arrêter pour elle.
const { data: pays, error: erreurPays } = await supabase
  .from('taxonomies')
  .select('key, labels')
  .eq('domain', 'country')
if (erreurPays) console.warn(`⚠️  Pays non lus (${erreurPays.message}) — les recettes sortiront sans \`recipeCuisine\`.`)
const nomDuPays = new Map(
  (pays ?? []).map(p => [p.key, p.labels?.[LANG] ?? p.labels?.fr ?? null]),
)

// Même garde-fou que le sitemap : ne JAMAIS écrire un manifeste vide. Une
// requête qui ne rend rien (RLS, panne, filtre trop strict) doit laisser le
// fichier précédent en place.
if (!data?.length) {
  console.error("❌  0 recette retournée — le fichier existant est CONSERVÉ. Rien n'a été écrit.")
  process.exit(1)
}

const entrees = data.map(r => {
  const nom = r.name?.[LANG] ?? r.name?.fr ?? r.id
  const description = r.description?.[LANG] ?? r.description?.fr ?? null
  // `image_url` est déjà ABSOLUE en base (URL du bucket `recipe-photos`) —
  // vérifié le 2026-08-15. Une `og:image` relative serait ignorée par la
  // plupart des crawlers, donc on refuse ce qui n'est pas absolu plutôt que de
  // produire une balise silencieusement inerte.
  const image = r.image_url && /^https?:\/\//.test(r.image_url) ? r.image_url : null
  // ── Les champs COURTS du balisage `Recipe` (2026-09-12) ───────────────────
  // Ce que Google AFFICHE dans un résultat enrichi de recette — la durée
  // surtout — vient de propriétés « recommandées » que le HTML servi ne portait
  // pas : il se limitait à nom, image et description, alors que le balisage
  // injecté au montage, lui, était complet. Les robots qui n'exécutent pas
  // JavaScript — la plupart des robots d'IA — ne voyaient donc que le socle.
  //
  // ⚠️ Volontairement COURTS. Les ingrédients et les étapes coûteraient environ
  // 500 Ko versionnés, régénérés en bloc à chaque ajout de recette : décision
  // séparée, cf. le commentaire de `corpsRecette` dans prerender-page.test.js.
  // Une entrée n'est écrite que si la donnée existe : `null` traverserait
  // jusqu'au balisage et y décrirait faux.
  const nombreOuNull = (v) => (Number.isFinite(v) && v > 0 ? v : null)
  return {
    id: r.id, nom, description, image,
    ...(nombreOuNull(r.time_min) && { dureeTotaleMin: r.time_min }),
    ...(nombreOuNull(r.prep_time_min) && { preparationMin: r.prep_time_min }),
    ...(nombreOuNull(r.cook_time_min) && { cuissonMin: r.cook_time_min }),
    ...(nombreOuNull(r.servings) && { portions: r.servings }),
    ...(r.type && { categorie: r.type }),
    ...(nomDuPays.get(r.country) && { cuisine: nomDuPays.get(r.country) }),
  }
})

// ── Dimensions RÉELLES des images (catalogue mixte, décision 2026-08-26) ────
// Les nouvelles photos sont en 1536×1024, les anciennes en 1024×1024. Les
// balises `og:image:width/height` doivent dire la vérité par recette : on
// MESURE donc chaque image (téléchargement + sharp) plutôt que de déclarer
// une constante devenue fausse pour une partie du catalogue.
// En échec (réseau, fichier corrompu) : l'entrée reste SANS dimensions et le
// pré-rendu retombe sur le carré historique (`dimsImageRecette`) — un repli,
// jamais un blocage du manifeste entier.
const { default: sharp } = await import('sharp')
const aMesurer = entrees.filter(e => e.image)
const CONCURRENCE = 8
let mesurees = 0
let echecs = 0
for (let i = 0; i < aMesurer.length; i += CONCURRENCE) {
  await Promise.all(aMesurer.slice(i, i + CONCURRENCE).map(async entree => {
    try {
      const reponse = await fetch(entree.image)
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
      const octets = Buffer.from(await reponse.arrayBuffer())
      const meta = await sharp(octets).metadata()
      if (!meta.width || !meta.height) throw new Error('dimensions illisibles')
      entree.largeur = meta.width
      entree.hauteur = meta.height
      mesurees++
    } catch (err) {
      echecs++
      console.warn(`⚠️  ${entree.id} : dimensions non mesurées (${err.message}) — repli carré au pré-rendu.`)
    }
  }))
}

const sansDescription = entrees.filter(e => !e.description).length
const avecImage = entrees.filter(e => e.image).length

const manifeste = {
  _commentaire: 'FICHIER GÉNÉRÉ par `npm run prerender:data` — ne pas éditer à la main.',
  _genere_le: new Date().toISOString().slice(0, 10),
  lang: LANG,
  recettes: entrees,
}

writeFileSync(SORTIE, JSON.stringify(manifeste, null, 2) + '\n', 'utf-8')
console.log(`✅  prerender-manifest.json écrit : ${entrees.length} recettes (${avecImage} avec photo, ${sansDescription} sans description).`)
console.log(`   Dimensions mesurées : ${mesurees}/${aMesurer.length}${echecs ? ` — ⚠️ ${echecs} échec(s), repli carré pour celles-là` : ''}.`)
