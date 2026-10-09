import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Garde-fou : `index.html` est servi TEL QUEL pour toutes les routes.
// Toute balise qui y désigne UNE url en dur s'applique donc aussi aux 515 pages
// `/recipe/:id` — et leur fait dire qu'elles sont une autre page.
//
// CE QUI ÉTAIT EN PRODUCTION JUSQU'AU 2026-08-13
//   <link rel="canonical" href="https://fridgeplus.app/" />
//   <meta property="og:url" content="https://fridgeplus.app/" />
// Mesuré sur `https://fridgeplus.app/recipe/salade-cesar` : le JSON-LD `Recipe`
// était correct (« Salade César »), mais le canonical annonçait l'accueil.
// Autrement dit, la page se déclarait doublon de la page d'accueil — le signal
// qui empêche son indexation, alors que ces URLs partageables sont sa raison
// d'être.
//
// 🔴 POURQUOI LE CORRECTIF « ÉVIDENT » EST FAUX
// Injecter le bon canonical en JavaScript depuis la page recette est
// explicitement déconseillé : Google (doc mise à jour en décembre 2025) demande
// de ne PAS remplacer par JS un canonical différent de celui du HTML d'origine.
// La canonicalisation se joue avant ET après rendu ; deux signaux
// contradictoires donnent une indexation imprévisible. Ce test interdit donc
// AUSSI de recréer le problème en JS.
//
// ⚠️ Ce test ne dit rien des aperçus de partage (WhatsApp, Facebook, Discord…) :
// leurs crawlers n'exécutent pas JS. Ils sont corrigés depuis le 2026-08-15 par
// le PRÉ-RENDU (`scripts/prerender.mjs`) — et non par un rendu serveur, comme ce
// commentaire l'a affirmé jusque-là : un pré-rendu statique suffit, prouvé en
// preview. Cf. la note interne sur le pré-rendu SEO.
//
// ── Ce que le pré-rendu change pour CE test (2026-08-15) ───────────────────
// Chaque page `/recipe/:id` est désormais servie avec SON canonical, écrit dans
// le HTML au build. L'interdit ci-dessous reste entier pour `index.html` (le
// gabarit commun, qui parlerait au nom des 515 pages) et pour toute INJECTION
// en JS.
//
// En revanche, `use-seo-meta.js` doit pouvoir LIRE ce canonical (pour ne pas
// écraser les métadonnées d'une page pré-rendue) et le RETIRER quand il est
// périmé — dans une SPA, le `<link>` survit à la navigation, et un accueil qui
// garderait le canonical d'une recette se déclarerait doublon de cette recette :
// le bug du 2026-08-13, à l'envers.
// D'où la distinction ci-dessous : lire et supprimer sont permis, ÉCRIRE reste
// interdit.

const INDEX = resolve(process.cwd(), 'index.html')
const RACINE_SRC = resolve(process.cwd(), 'src')

describe('SEO — aucune URL en dur ne peut parler au nom de toutes les routes', () => {
  const html = readFileSync(INDEX, 'utf8')

  // On ignore les commentaires : l'explication ci-dessus cite les balises
  // qu'elle interdit, et se compterait elle-même.
  const htmlSansCommentaires = html.replace(/<!--[\s\S]*?-->/g, '')

  it("index.html ne contient pas de <link rel='canonical'>", () => {
    expect(htmlSansCommentaires).not.toMatch(/<link[^>]+rel=["']canonical["']/i)
  })

  it("index.html ne contient pas de <meta property='og:url'>", () => {
    expect(htmlSansCommentaires).not.toMatch(/property=["']og:url["']/i)
  })

  it('le test lit bien un index.html non vide (sinon il serait aveugle)', () => {
    // Témoins : des balises qui doivent, elles, rester présentes.
    expect(htmlSansCommentaires).toMatch(/property=["']og:title["']/i)
    expect(htmlSansCommentaires).toMatch(/name=["']description["']/i)
  })
})

// Seules formes tolérées : interroger le canonical existant, ou le supprimer.
// Elles sont neutralisées avant l'analyse ; tout ce qui reste est suspect.
const LECTURE_OU_SUPPRESSION = [
  /querySelector\(\s*['"]link\[rel="canonical"\]['"]\s*\)/g,
  /'link\[rel="canonical"\]'/g,
]

// Le code seul, sans les commentaires. Un fichier qui EXPLIQUE pourquoi il ne
// faut pas injecter de canonical cite forcément la balise : sans ce
// dépouillement, le garde-fou accuserait sa propre documentation.
// (Même correctif que `budget-guard-edge.test.js` le 2026-08-14, où l'oubli
// inverse — analyser du texte brut — rendait un cliquet aveugle.)
function sansCommentaires(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !l.trim().startsWith('//'))
    .join('\n')
}

describe('SEO — le canonical n’est pas non plus réintroduit en JavaScript', () => {
  it("aucun code n'ÉCRIT de canonical côté client", () => {
    // Google déconseille explicitement de faire diverger le canonical rendu de
    // celui du HTML d'origine. Cf. l'en-tête de ce fichier.
    const fichiers = collecterSources(RACINE_SRC)
    const fautifs = fichiers.filter(({ contenu }) => {
      const code = sansCommentaires(contenu)
      const sansLecture = LECTURE_OU_SUPPRESSION.reduce((acc, re) => acc.replace(re, ''), code)
      return /rel=["']canonical["']|["']canonical["']\s*\)/.test(sansLecture)
    })
    expect(
      fautifs.map(f => f.chemin),
      'Un canonical injecté en JS entre en conflit avec le HTML servi.\n' +
      'Lire ou retirer le canonical pré-rendu est permis ; en écrire un, non.\n' +
      'Cf. la note interne sur le pré-rendu SEO.',
    ).toEqual([])
  })

  it("aucun code ne FABRIQUE de balise canonical (createElement + rel)", () => {
    // Motif que la neutralisation ci-dessus ne doit jamais laisser passer :
    // construire le lien plutôt que d'écrire son attribut littéralement.
    const fichiers = collecterSources(RACINE_SRC)
    const fautifs = fichiers.filter(({ contenu }) => {
      const code = sansCommentaires(contenu)
      return /\.rel\s*=\s*['"]canonical['"]/.test(code)
        || /setAttribute\(\s*['"]rel['"]\s*,\s*['"]canonical['"]/.test(code)
        || /(innerHTML|insertAdjacentHTML)[\s\S]{0,120}rel=["']canonical/.test(code)
    })
    expect(fautifs.map(f => f.chemin)).toEqual([])
  })

  it('le hook SEO lit le canonical, et ne fait que ça', () => {
    // Témoin explicite : ce fichier EST l'exception, et on vérifie qu'il reste
    // dans son rôle — sinon l'exception deviendrait une porte ouverte.
    const hook = readFileSync(resolve(RACINE_SRC, 'shared/hooks/use-seo-meta.js'), 'utf8')
    expect(hook, 'le hook doit consulter le canonical').toMatch(/querySelector\(\s*['"]link\[rel="canonical"\]['"]/)
    expect(hook, 'le hook ne doit pas CRÉER de canonical').not.toMatch(/createElement\(\s*['"]link['"]/)
  })
})

function collecterSources(racine, acc = []) {
  const { readdirSync, statSync } = require('node:fs')
  const { join } = require('node:path')
  for (const entree of readdirSync(racine)) {
    if (entree === 'node_modules' || entree === 'test') continue
    const chemin = join(racine, entree)
    if (statSync(chemin).isDirectory()) collecterSources(chemin, acc)
    else if (/\.(js|jsx)$/.test(entree)) {
      acc.push({ chemin: chemin.replace(process.cwd(), '').replace(/\\/g, '/'), contenu: readFileSync(chemin, 'utf8') })
    }
  }
  return acc
}
