// Palettes des compartiments du frigo, partagées entre `fridge-multi-door.jsx`
// (le châssis) et `fridge-interiors.jsx` (les intérieurs).
//
// ⚠️ Dans un `.js` et non dans le `.jsx` des composants : un fichier qui
// exporte à la fois un composant et une constante déclenche
// `react-refresh/only-export-components`, or le plafond de warnings du projet
// est à 100 pile.

export const COLORS = {
  freezer:   { bg: '#E8F4F8', text: '#5B9AAE' },
  fresh:     { bg: '#E8F5E9', text: '#7BB078' },
  vegetable: { bg: '#F1F5E8', text: '#6B8E23' },
  crisper:   { bg: '#F1F5E8', text: '#6B8E23' },
  leftovers: { bg: '#F5F5F5', text: '#9E9E9E' },
}

export const COLORS_DARK = {
  freezer:   { bg: '#182535', text: '#6AAFCA' },
  fresh:     { bg: '#162515', text: '#8CC488' },
  vegetable: { bg: '#182215', text: '#85A040' },
  crisper:   { bg: '#182215', text: '#85A040' },
  leftovers: { bg: '#1E2020', text: '#909090' },
}
