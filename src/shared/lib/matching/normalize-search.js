// Normalisation des chaînes pour la RECHERCHE et le filtrage à l'écran.
//
// POURQUOI CE MODULE EXISTE — deux défauts mesurés le 2026-08-07 dans trois
// copies locales d'un `normalize()` (panneau d'inventaire, revue de ticket
// scanné, confirmation vocale), toutes écrites ainsi :
//
//     str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
//
// 1. ⚠️ NFD NE DÉCOMPOSE PAS LA LIGATURE « œ ». Ce n'est pas une lettre
//    accentuée mais un caractère à part entière (U+0153) : ni NFD ni NFKD ne le
//    séparent en « oe ». Sans remplacement explicite, « Bœuf » se normalise en
//    « bœuf », et taper « boeuf » au clavier ne le trouve donc PAS — alors que
//    le catalogue contient huit entrées concernées (Bœuf, Bœuf haché, Steak
//    bœuf, Rôti bœuf, Filet bœuf…). Les trois fichiers portaient pourtant le
//    commentaire « tape "creme" ou "oeuf" et ça matche quand même » : l'intention
//    était juste, le code ne la tenait pas.
//
// 2. ⚠️ `\p{Diacritic}` EST TROP LARGE POUR LE JAPONAIS. Il englobe le dakuten
//    et le prolongateur : « がぎ » devenait « かき » et « ソーセージ » devenait
//    « ソセシ ». Comme la saisie et les données passent par la même fonction, la
//    recherche continuait de répondre — mais des ingrédients distincts se
//    confondaient. On s'en tient donc au bloc des diacritiques combinants
//    (U+0300–U+036F), qui couvre le français sans toucher aux kana.
//
// Ce corps est celui, déjà éprouvé en production, du normaliseur de
// `ingredient-text-matcher.js` (reconnaissance vocale et scan de ticket), qui
// s'appuie désormais sur ce module : une seule définition fait foi.

/**
 * Minuscule, ligatures développées, diacritiques latins retirés.
 *
 * ⚠️ L'ORDRE COMPTE : `toLowerCase()` d'abord, sinon « Œuf » (majuscule)
 * échappe au remplacement et reste non trouvable.
 *
 * @param {string} s
 * @returns {string}
 */
export function normalizeSearch(s) {
  return String(s ?? '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}
