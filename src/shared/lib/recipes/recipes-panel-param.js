// Panneau Recettes piloté par l'URL (?recettes=1).
//
// Le panneau de browsing est un overlay in-app, pas une route : ouvrir
// le panneau ne change pas de page. On encode son ouverture dans un query
// param sur '/' pour que :
//   - un clic recette (navigate /recipe/:id) puis retour navigateur
//     rouvre le panneau dans le même état (filtres URL-synced + scroll),
//   - le lien « Toutes les recettes » (/?recettes=1) ouvre le panneau au
//     deep-link.
//
// Fonctions pures (testables sans router) : lecture + écriture du param
// sans toucher aux autres params (filtres existants).

export const RECIPES_PANEL_PARAM = 'recettes'

// Lit l'état d'ouverture depuis une querystring (location.search).
export function isRecipesPanelOpen(search) {
  return new URLSearchParams(search).get(RECIPES_PANEL_PARAM) === '1'
}

// Retourne une nouvelle URLSearchParams avec le param ajouté/retiré,
// en préservant tous les autres params (filtres). Ne mute pas l'entrée.
export function withRecipesPanel(search, open) {
  const next = new URLSearchParams(search)
  if (open) next.set(RECIPES_PANEL_PARAM, '1')
  else next.delete(RECIPES_PANEL_PARAM)
  return next
}
