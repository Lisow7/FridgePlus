// WCAG 2.2, 2.5.8 « Taille de la cible (minimum) » : 24 × 24 px. `<Button>`
// (shared/ui/button.jsx) le porte en classes (`min-h-6 min-w-6`) ; les rares
// `<button>` bruts, stylés en ligne, étalent ceci (audit du 2026-10-04,
// A11Y-13). Le centrage va avec : sans lui, l'icône resterait collée en haut
// à gauche d'un bouton devenu plus grand qu'elle.
export const CIBLE_MINIMALE = Object.freeze({
  minWidth: '24px', minHeight: '24px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
})
