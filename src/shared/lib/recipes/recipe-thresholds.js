// Les seuils qui classent une recette selon ce qu'on a dans le frigo.
// « Presque » : au moins 60 % des ingrédients de la recette, sans les avoir
// tous. La roulette tire parmi les recettes à 70 % ou plus. Un seul endroit
// pour ces nombres : les filtres, les compteurs, la carte « Bien démarrer », la
// roulette ET les textes qui les décrivent (audit du 2026-10-04, UX-09 : trois
// définitions de « Presque » circulaient — 60 %, « un ou deux ingrédients »,
// « 70 % de ton stock »).
export const SEUIL_PRESQUE = 0.6
export const SEUIL_ROULETTE = 0.7

export const estPresque = (matchPercent) => matchPercent >= SEUIL_PRESQUE && matchPercent < 1
export const enPourcent = (seuil) => Math.round(seuil * 100)
