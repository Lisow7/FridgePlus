import { useEffect } from 'react'

// Pose le `<title>` de l'onglet le temps d'une page, et restaure le précédent
// au démontage.
//
// ── Pourquoi ce hook existe, alors que `useSeoMeta` gère déjà le titre ──────
// `useSeoMeta` s'arrête net sur une page PRÉ-RENDUE : le HTML servi y porte
// déjà son propre titre, plus juste que le titre générique du site, et
// l'écraser ferait dire au DOM l'inverse du HTML d'origine (cf. l'en-tête de
// `use-seo-meta.js`).
//
// Conséquence pour les pages statiques pré-rendues : leur titre est FIGÉ en
// français, puisque le pré-rendu produit une seule langue. Sur une page recette
// c'est acceptable — le nom du plat change peu d'une langue à l'autre. Sur
// `/faq` et `/guide`, dont TOUT le corps bascule fr/en, un visiteur anglophone
// verrait un onglet en français au-dessus d'un texte en anglais.
//
// D'où ce hook, et la répartition qu'il installe :
//   · le HTML SERVI (donc ce que voit un crawler, et le canonical) reste en
//     français, inchangé — c'est l'identité de l'URL, elle ne bouge pas ;
//   · le titre AFFICHÉ suit la langue du visiteur, une fois le JS exécuté.
//
// ⚠️ Ne touche ni au canonical, ni aux `og:*`. Ces balises désignent l'URL et
// servent aux crawlers, qui lisent le HTML servi : les réécrire côté client ne
// changerait rien pour eux et rouvrirait le bug du canonical transversal.
//
// ── L'ordre des effets, MESURÉ et non supposé (2026-08-16) ─────────────────
// `useSeoMeta` est appelé depuis `App.jsx` et écrit lui aussi `document.title`.
// En navigation interne il n'y a pas de canonical, donc il ne s'arrête pas :
// s'il tournait APRÈS ce hook, il reposerait le titre générique et la promesse
// ci-dessus serait fausse.
//
// Vérifié au navigateur, pas déduit : 3 allers-retours accueil → `/faq` (donc
// avec le chunk paresseux déjà en cache) + `/legal` + `/changelog`. Le titre
// reste celui de la page à chaque passage. La preuve que `useSeoMeta` tourne
// bel et bien — et AVANT — est que `meta[name="description"]`, qu'il est seul à
// écrire, redevient générique alors que le titre, lui, tient.
//
// 🔴 Ne pas « corriger » cet ordre sans le re-mesurer de la même façon : lire
// la valeur finale de `document.title` ne suffit pas (écrire deux fois la même
// chaîne ne déclenche aucune mutation observable), et `changelog-page.jsx`
// porte ce patron depuis des mois en production.

export function useDocumentTitle(titre) {
  useEffect(() => {
    if (!titre) return undefined
    const precedent = document.title
    document.title = titre
    return () => { document.title = precedent }
  }, [titre])
}
