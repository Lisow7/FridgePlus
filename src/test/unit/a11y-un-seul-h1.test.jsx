import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Garde-fou : UN SEUL `<h1>` par page.
//
// ── Ce qui était faux avant le 2026-08-22 ─────────────────────────────────
// `HeaderLogo` posait `<h1 class="sr-only">Fridge+</h1>`. L'en-tête étant monté
// sur TOUTES les routes, chaque page qui portait déjà son propre titre en
// affichait deux : celui du site, puis celui de la page. Un lecteur d'écran qui
// liste les titres de niveau 1 en voyait donc deux, dont un qui ne décrit pas
// la page où l'on se trouve.
//
// ⚠️ Le HTML PRÉ-RENDU n'a jamais eu ce défaut : il ne contient que le corps de
// la page, pas l'en-tête (`src/prerender/corps-statique.js`). Le doublon
// n'existait qu'au rendu JavaScript — l'enjeu est sémantique, pas SEO. C'est
// pour ça qu'aucun contrôle du pré-rendu ne pouvait l'attraper.
//
// ── Pourquoi l'accueil a besoin d'un `<h1>` À LUI ─────────────────────────
// 🔴 Retirer le `<h1>` de l'en-tête ne suffit pas : mesuré le 2026-08-22, la
// page d'accueil était la SEULE route sans titre de premier niveau propre — le
// `sr-only` de l'en-tête était son unique `<h1>`. Le supprimer sans compenser
// l'aurait laissée sans aucun titre, en échangeant un défaut mineur (deux
// titres) contre un défaut plus grave (aucun).
//
// Toutes les autres routes en avaient déjà un, vérifié un fichier à la fois :
// `/legal` `/changelog` `/faq` `/guide` `/community` `/recipe/:id` `/cart`
// `/cook/:id` `/login` `/signup` `404`, et les 6 sous-pages `/profile` via
// `ProfilePageIntro`.
//
// ── Pourquoi un test de STRUCTURE ─────────────────────────────────────────
// Même raison que `a11y-navigation-clavier.test.js` : monter `AppShell` réclame
// une quarantaine de props et trois providers. Le contrat vérifié ici tient en
// deux pièces qui n'ont de sens qu'ensemble — l'en-tête n'en pose plus, et
// l'accueil en pose un.
//
// La contrepartie du rendu manquant est couverte ailleurs : `e2e/a11y.spec.js`
// fait tourner `page-has-heading-one` d'axe-core sur les 6 pages publiques,
// dans les deux thèmes. Ce test-ci dit POURQUOI le code est ainsi ; le test E2E
// prouve que le résultat rendu est correct.

const HEADER_LOGO = readFileSync(
  resolve(process.cwd(), 'src/app/layout/header/HeaderLogo.jsx'), 'utf8',
)
const ACCUEIL = readFileSync(
  resolve(process.cwd(), 'src/app/components/fridge-home-view.jsx'), 'utf8',
)

// Les commentaires sont retirés AVANT toute recherche : le 2026-08-14, un
// cliquet de ce dépôt attrapait un appel supprimé mais pas un appel commenté.
// Ici l'énoncé du contrat figure justement en commentaire juste au-dessus.
function sansCommentaires(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const entete = sansCommentaires(HEADER_LOGO)
const accueil = sansCommentaires(ACCUEIL)

describe('un seul <h1> par page — les 2 pièces du contrat', () => {
  it('l’en-tête ne pose AUCUN <h1>', () => {
    expect(entete).not.toMatch(/<h1[\s>]/)
  })

  it('l’en-tête annonce toujours le nom du site aux lecteurs d’écran', () => {
    // Le nom ne disparaît pas : il cesse seulement d'être un TITRE. Sans cette
    // assertion, supprimer purement et simplement la ligne ferait passer le
    // test précédent tout en retirant l'information.
    expect(entete).toMatch(/<p className="sr-only">Fridge\+<\/p>/)
  })

  it('l’accueil pose son propre <h1>', () => {
    expect(accueil).toMatch(/<h1[\s>]/)
  })

  it('le <h1> de l’accueil est dérivé du layout, pas d’un dictionnaire de plus', () => {
    // 🥇 Un dictionnaire hors d'un fichier `*i18n*` échappe au garde-fou de
    // parité des langues. `layout` porte déjà les libellés affichés par la
    // page — le titre reste donc cohérent avec ce qui est RÉELLEMENT à l'écran,
    // y compris quand la langue retombe sur le fallback.
    //
    // 🔴 L'assertion porte sur le CONTENU du `<h1>`, pas sur le fichier. Écrite
    // d'abord comme un `toMatch(/layout\.fridgeLabel/)` sur tout le source, elle
    // était TAUTOLOGIQUE : les lignes 94-95 utilisent déjà ces deux libellés
    // pour les onglets mobiles, et le test passait donc AVANT que le `<h1>`
    // existe. Un test qui boucle sur ce qu'il ne contrôle pas ne prouve rien.
    const bloc = accueil.match(/<h1[\s\S]*?<\/h1>/)
    expect(bloc, '<h1> introuvable dans fridge-home-view').not.toBeNull()
    expect(bloc[0]).toMatch(/layout\.fridgeLabel/)
    expect(bloc[0]).toMatch(/layout\.pantryLabel/)
  })
})
