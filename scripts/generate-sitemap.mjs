/**
 * Génère `public/sitemap.xml` avec l'accueil, les pages statiques publiques
 * (`PAGES_STATIQUES`, partagée avec le pré-rendu) et toutes les pages recette
 * publiquement atteignables.
 *
 * Usage : `npm run sitemap` — puis COMMITER le fichier produit.
 *
 * ── Pourquoi un script manuel, et pas une génération au build ──────────────
 * La CI ne porte AUCUNE clé Supabase : `ci.yml` injecte `VITE_SUPABASE_URL` et
 * `VITE_SUPABASE_ANON_KEY` vides, et le client retombe sur ses placeholders.
 * Brancher cette requête sur `npm run build` ferait donc soit échouer la CI,
 * soit — bien pire — produire silencieusement un sitemap vide à chaque
 * déploiement. Même patron que `npm run og` et `npm run migrate` : le
 * mainteneur lance, le résultat est versionné.
 *
 * ── Pourquoi pas une route serverless dynamique ───────────────────────────
 * Elle serait toujours à jour, mais échangerait un fichier statique qui marche
 * toujours contre une dépendance d'exécution qui peut rendre 500 — sur une
 * route où l'échec signifie que Google ne reçoit RIEN plutôt que quelque chose.
 *
 * ── Contrepartie assumée : la fraîcheur ───────────────────────────────────
 * Le sitemap est figé jusqu'à la prochaine exécution. Sans conséquence
 * aujourd'hui (515 recettes officielles stables, 0 recette communauté), et
 * Google découvre aussi par les liens. À relancer après un ajout de recettes.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { PAGES_STATIQUES, pagesAuPlanDuSite, filtrerRecettesPubliables, idValide } from './lib/prerender-page.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://fridgeplus.app'
const SORTIE = join(root, 'public', 'sitemap.xml')

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
// Clé PUBLIABLE et non service_role : on ne lit que ce qu'un visiteur anonyme
// voit déjà. Moindre privilège — et si la RLS masquait une recette, c'est
// précisément qu'elle ne doit pas figurer au sitemap.
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Variables manquantes : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// Le filtre doit dire EXACTEMENT la même chose que la propriété `url` du
// JSON-LD (`recipe-to-schema-org.js`) : ne lister que des pages que
// `useRecipeById` sait rendre. Un sitemap qui pointe vers une page rendue
// « introuvable » est le defaut qu'on vient d'eviter dans le JSON-LD.
const { data: lignes, error } = await filtrerRecettesPubliables(
  supabase.from('recipes_unified').select('id, updated_at'),
).order('id')

// Un identifiant finit dans une balise `<loc>` : tout ce qui n'est pas un slug
// est écarté, comme le fait le pré-rendu (un `&` ou un `<` invaliderait le
// fichier entier).
const data = (lignes ?? []).filter(r => idValide(r.id))
if (lignes && data.length !== lignes.length) {
  console.warn(`⚠️  ${lignes.length - data.length} identifiant(s) écarté(s) : pas des slugs.`)
}

if (error) {
  console.error('❌  Lecture Supabase échouée :', error.message)
  process.exit(1)
}

// Garde-fou : ne JAMAIS écrire un sitemap vide. Une requête qui ne rend rien
// (RLS, panne, filtre trop strict) doit laisser le fichier précédent en place —
// un sitemap réduit à une URL serait pire que pas de régénération du tout.
if (!data?.length) {
  console.error('❌  0 recette retournée — le fichier existant est CONSERVÉ. Rien n\'a été écrit.')
  process.exit(1)
}

// `/community` n'est annoncée que si son fil a des messages visibles
// (`pagesAuPlanDuSite`). La clé publiable voit ce que voit un visiteur.
const { count: messagesCommunaute, error: erreurCommunaute } = await supabase
  .from('community_posts')
  .select('id', { count: 'exact', head: true })
  .is('deleted_at', null)
if (erreurCommunaute) {
  console.warn(`⚠️  Fil de la communauté non compté (${erreurCommunaute.message}) — /community n'est pas annoncée.`)
}
const pages = pagesAuPlanDuSite({ messagesCommunaute: erreurCommunaute ? null : messagesCommunaute })

// Seule une recette a une VRAIE date de modification (`updated_at`).
// L'accueil et les pages statiques portaient la date du jour de GÉNÉRATION :
// Google ignore un `lastmod` qu'il juge peu fiable, et pas seulement sur ces
// pages-là (audit du 2026-10-04, SEO-10). Pas de date vaut mieux qu'une
// fausse. `changefreq` et `priority` sont retirés : Google les ignore, et
// ils ne disaient rien de vrai.
const date = (v) => (v ? `\n    <lastmod>${String(v).slice(0, 10)}</lastmod>` : '')

// Les pages statiques viennent de la MÊME liste que le pré-rendu
// (`PAGES_STATIQUES`), pas d'une copie locale. Une page déclarée au sitemap
// mais non pré-rendue servirait le titre générique de l'accueil ; une page
// pré-rendue mais absente du sitemap se priverait de sa découverte. Les deux
// écarts sont silencieux — d'où la source unique.
const urls = [
  `  <url>
    <loc>${SITE}/</loc>
  </url>`,
  ...pages.map(p => `  <url>
    <loc>${SITE}${p.chemin}</loc>
  </url>`),
  ...data.map(r => `  <url>
    <loc>${SITE}/recipe/${r.id}</loc>${date(r.updated_at)}
  </url>`),
]

// Le commentaire hreflang est REPOSÉ à chaque génération : c'est la 3ᵉ trace
// d'une décision déjà prise deux fois. Un générateur qui l'efface en silence
// rouvre une question tranchée.
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Fichier GÉNÉRÉ par \`npm run sitemap\` (scripts/generate-sitemap.mjs).
     Ne pas éditer à la main : la prochaine exécution écrasera les retouches. -->
<!-- Pas d'annotations hreflang ici non plus : elles pointaient toutes vers
     l'unique URL d'accueil, ce qui ne décrit aucune alternative (la langue
     vient de localStorage, pas de l'URL). Voir le commentaire détaillé dans
     index.html. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

writeFileSync(SORTIE, xml, 'utf-8')
console.log(`✅  sitemap.xml écrit : ${data.length} recettes + l'accueil + ${pages.length} pages statiques sur ${PAGES_STATIQUES.length} (${urls.length} URLs ; ${messagesCommunaute ?? '?'} message(s) visible(s) dans la communauté).`)
