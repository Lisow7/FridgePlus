// Sprint 6 PR S6.b — Pure function `categorizeIngredientsByStorage`.
//
// Heuristique : découpe une liste d'ids d'ingrédients par zone de
// stockage (frigo vs garde-manger) selon le préfixe d'id. Utilisé pour
// composer des toasts précis (« 3 ajoutés au frigo, 1 au garde-manger »).
//
// Convention de préfixes (cf. README.md, conventions d'identifiants) :
//   - `gp-*` / `sp-*` / `bk-*` → garde-manger (épicerie sèche, épices,
//     boulangerie)
//   - `fr-*` / `vg-*` / `frz-*` / `jp-*` → frigo (frais, légumes,
//     surgelés, japonais frais)
//   - Tout autre préfixe → frigo par défaut (sécurité plutôt que
//     garde-manger pour ne pas suggérer de mettre du frais à température
//     ambiante).
//
// Retour : `{ fridge: number, pantry: number }`.

const PANTRY_PREFIXES = ['gp-', 'sp-', 'bk-']

export function categorizeIngredientsByStorage(ids) {
  let fridge = 0
  let pantry = 0
  for (const id of ids ?? []) {
    if (typeof id !== 'string') continue
    if (PANTRY_PREFIXES.some(p => id.startsWith(p))) pantry++
    else fridge++
  }
  return { fridge, pantry }
}
