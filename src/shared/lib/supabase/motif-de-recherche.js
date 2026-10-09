// La saisie d'une recherche « contient » (ILIKE), protégée.
//
// Audit du 2026-10-04, ADM-10. Mesuré le 2026-10-08 sur la vraie API, en
// lecture seule (`base_recipes`, clé publique) :
//   - dans un motif ILIKE, `%` et `_` sont des JOKERS. Le code qui les retirait
//     rendait le pseudo « jean_dupont » introuvable ; celui qui les laissait
//     faisait de « _ » un « n'importe quoi » (515 recettes sur 515) ;
//   - dans un filtre `.or()` de PostgREST, une virgule ou une parenthèse non
//     protégée casse la requête (400) — « poulet, riz », « tarte (aux pommes) ».
//     Entre guillemets, elle passe ; mais PostgREST y retire DEUX niveaux de
//     barre oblique inverse : pour qu'ILIKE reçoive `\_`, il faut en envoyer 4.
//     Hors d'un `.or()` (`.ilike(colonne, motif)`), un seul niveau.

/** Motif ILIKE « contient » pour `.ilike(colonne, motif)` : `%`, `_` et `\` y valent pour eux-mêmes. */
export function motifContient(saisie) {
  return `%${String(saisie ?? '').trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/**
 * Le même motif, pour une condition d'un filtre `.or()` :
 * `.or(\`id.ilike.${m},nom.ilike.${m}\`)` avec `m = motifDansOu(saisie)`.
 * Entre guillemets, et chaque barre oblique inverse doublée deux fois (voir
 * plus haut). Les guillemets de la saisie sont retirés : aucun nom n'en
 * contient, et leur échappement dépendrait des mêmes deux niveaux.
 */
export function motifDansOu(saisie) {
  return `"${motifContient(String(saisie ?? '').replace(/"/g, '')).replace(/\\/g, '\\\\\\\\')}"`
}
