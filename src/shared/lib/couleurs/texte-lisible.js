// Une couleur d'accent (orange de marque, vert, ambre, rouge, bleu, violet)
// employée comme TEXTE passe rarement le seuil de contraste WCAG AA (4,5:1) :
// l'audit du 2026-10-04 (A11Y-03, palette de l'admin) en relevait des dizaines,
// à 2,6-3,3:1 sur les fonds clairs.
//
// `texteLisible(accent)` la mêle au charbon du thème (`--color-charcoal` :
// foncé en clair, clair en sombre), dans la part `--part-accent-texte` que fixe
// index.css pour chaque thème (50 % / 35 %) : la teinte reste reconnaissable, et
// le pire cas mesuré passe à 4,97:1 en clair et 4,71:1 en sombre, sur tous les
// fonds de l'admin. La décision « couleurs profondes » de la décision du 2026-10-06
// (2026-10-06), appliquée aux textes.

/** La couleur `accent` (hex ou `var(--…)`) rendue lisible comme texte, dans les deux thèmes. */
export function texteLisible(accent) {
  return `color-mix(in srgb, ${accent} var(--part-accent-texte), var(--color-charcoal))`
}

/**
 * Un fond légèrement teinté de `accent`. Remplace `${accent}18` : collé à une
 * variable CSS, ce suffixe donnait `var(--…)18`, une valeur invalide que le
 * navigateur ignorait — le fond actif d'une pastille n'apparaissait jamais.
 */
export function fondTeinte(accent, part = 12) {
  return `color-mix(in srgb, ${accent} ${part}%, transparent)`
}
