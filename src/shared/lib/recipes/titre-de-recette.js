// Le titre d'une fiche recette, pour l'onglet et pour les moteurs (décision du
// 2026-10-08) : le nom d'abord, le mot cherché ensuite — « Risotto aux
// champignons : la recette — Fridge+ ». Le titre affiché SUR la fiche ne change
// pas.
//
// Lu par la page vivante (`features/recipes/pages/recipe-page.jsx`, dans la
// langue affichée) et par le pré-rendu (`scripts/lib/prerender-page.mjs`, en
// français) : un seul format, sans dépendance — le script de build l'importe
// par son chemin.

// La typographie française veut une espace insécable avant le deux-points.
const ESPACE_INSECABLE = '\u00A0'

const FORMATS = {
  fr: (nom) => `${nom}${ESPACE_INSECABLE}: la recette — Fridge+`,
  en: (nom) => `${nom} recipe — Fridge+`,
}

export function titreDeRecette(nom, lang = 'fr') {
  return (FORMATS[lang] ?? FORMATS.fr)(nom)
}
