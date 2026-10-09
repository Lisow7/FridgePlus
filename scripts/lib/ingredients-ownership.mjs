/**
 * Qui possède quoi dans la table `ingredients` — logique PURE, testable.
 *
 * ── La règle, et ce qui la fonde ───────────────────────────────────────────
 * `labels`, `price`, `pack_size` et `nutrition` sont **éditables depuis l'admin
 * en production** (`ingredient-form.jsx`, `ingredient-extra-fields.jsx`). Une colonne qu'un humain peut modifier en prod ne peut pas
 * avoir sa source de vérité dans un fichier versionné : tout mécanisme qui la
 * reconstruit depuis les statiques finira par écraser une saisie humaine.
 *
 * Mesuré le 2026-08-15 avant de décider : la base est plus riche que les
 * statiques sur `labels` (**522**), `pack_size` (203), `nutrition` (2) et
 * `price` (2) — **zéro conflit de valeurs**, uniquement des langues en plus
 * (591 lignes portent `de`/`es`/`ja`).
 *
 * ⚠️ `labels` a failli être oublié : les trois autres avaient été repérés, pas
 * lui — alors que c'est LUI qui fait avorter `npm run migrate` aujourd'hui
 * (522 lignes). Le garde qui l'en protège existait déjà, seul de son espèce. Un `migrate` naïf les effacerait sans
 * rien casser ni signaler. Dossier : la note interne sur la propriété des données d’ingrédients.
 *
 * ⇒ Les statiques **amorcent** ces colonnes à la création d'un ingrédient, et
 *   n'y touchent plus jamais ensuite.
 *
 * ── Pourquoi DEUX lots et pas un seul ──────────────────────────────────────
 * 🔴 PostgREST refuse un lot dont les objets n'ont pas tous les mêmes clés
 * (« All object keys must match »). Envoyer des lignes complètes et des lignes
 * allégées dans le même `upsert` échouerait — ou, avec `defaultToNull`,
 * écrirait des NULL, c'est-à-dire exactement la destruction qu'on évite.
 * Chaque lot doit donc être homogène.
 */

/** Colonnes dont la BASE est propriétaire une fois la ligne créée. */
export const COLONNES_POSSEDEES_PAR_LA_BASE = ['labels', 'price', 'pack_size', 'nutrition']

/**
 * Sépare les lignes à écrire en deux lots homogènes.
 *
 * @param rows          lignes construites depuis les fichiers statiques
 * @param idsExistants  Set des `id` déjà présents en base
 * @returns { nouveaux, existants } — `nouveaux` complet (amorçage),
 *          `existants` privé des colonnes possédées par la base.
 */
export function partitionnerPourUpsert(rows, idsExistants) {
  const nouveaux = []
  const existants = []
  for (const row of rows) {
    if (idsExistants.has(row.id)) {
      const allege = { ...row }
      for (const col of COLONNES_POSSEDEES_PAR_LA_BASE) delete allege[col]
      existants.push(allege)
    } else {
      nouveaux.push({ ...row })
    }
  }
  return { nouveaux, existants }
}
