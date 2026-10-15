// Le plancher des petits textes (décision du 2026-10-08 ; audit du 2026-10-04,
// A11Y) : rien sous 12 px hors du panneau admin. Le réglage commun : le cliquet
// `petitsTextesPlafond` (scripts/petits-textes.mjs) le lit, et un petit texte
// s'écrit `fontSize: TEXTE_MIN_PX` plutôt qu'avec un nombre en dur.
export const TEXTE_MIN_PX = 12
